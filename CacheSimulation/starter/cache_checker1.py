import os
import sys
import re
import subprocess
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

DATA_DIR = "data"
GRAPH_N = 10000
DEGREES = [8, 16, 50, 100]

L1_CACHE = "32768,8,64"    
LL_CACHE = "1048576,16,64" 

def run_cmd(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error executing: {' '.join(cmd)}")
        print(result.stderr)
        sys.exit(1)
    return result

def run_cachegrind(impl, graph_path):
    for f in os.listdir('.'):
        if f.startswith('cachegrind.out.'):
            os.remove(f)

    cmd = [
        "valgrind", 
        "--tool=cachegrind", 
        "--cache-sim=yes",         
        f"--D1={L1_CACHE}",        
        f"--LL={LL_CACHE}",        
        "./graph_bench", 
        f"--impl={impl}", 
        f"--graph={graph_path}", 
        "--source=0", 
        "--repeat=25" 
    ]
    
    env = os.environ.copy()
    env["LC_ALL"] = "C"
    
    subprocess.run(cmd, capture_output=True, text=True, env=env)
    
    cg_file = next((f for f in os.listdir('.') if f.startswith('cachegrind.out.')), None)
            
    if not cg_file:
        print(f"\n[!] Valgrind failed to produce output file for {impl}")
        return 0, 0
        
    events, summary = [], []
    with open(cg_file, 'r') as f:
        for line in f:
            if line.startswith('events:'):
                events = line.strip().split()[1:]
            elif line.startswith('summary:'):
                summary = line.strip().split()[1:]
                
    if not events or not summary:
        print(f"\n[!] Failed to find summary data in {cg_file}.")
        return 0, 0
        
    data = dict(zip(events, summary))
    d1_misses = int(data.get('D1mr', 0)) + int(data.get('D1mw', 0))
    lld_misses = int(data.get('DLmr', 0)) + int(data.get('DLmw', 0))
    
    return d1_misses // 25, lld_misses // 25

def format_thousands(x, pos):
    if x >= 1e6: return f'{x*1e-6:g}M'
    elif x >= 1e3: return f'{x*1e-3:g}k'
    return f'{x:g}'

def annotate_integer_points(x_vals, y_vals, ax, offset_y):
    for x, y in zip(x_vals, y_vals):
        ax.annotate(f"{y:,}", (x, y), textcoords="offset points", xytext=(0, offset_y), ha='center', fontsize=8, alpha=0.8)

def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    print("Building project...")
    run_cmd(["make"])

    ptr_d1, csr_d1 = [], []
    ptr_lld, csr_lld = [], []

    print("\nStarting Cachegrind Density Experiments...\n")

    for deg in DEGREES:
        graph_path = os.path.join(DATA_DIR, f"tuning_er_n{GRAPH_N}_deg{deg}.txt")
        print(f"Generating Target Graph (ER, N={GRAPH_N}, deg={deg})...")
        run_cmd(["python3", "scripts/gen_graph.py", "--kind", "er", "--n", str(GRAPH_N), "--deg", str(deg), "--seed", "1", "--out", graph_path])

        print(f"  Profiling Pointer...")
        d1, lld = run_cachegrind("pointer", graph_path)
        ptr_d1.append(d1)
        ptr_lld.append(lld)

        print(f"  Profiling CSR...")
        d1, lld = run_cachegrind("csr", graph_path)
        csr_d1.append(d1)
        csr_lld.append(lld)
        
        print(f"    -> Pointer (Avg/Run): D1={d1:,}, LLd={lld:,}")
        print(f"    -> CSR     (Avg/Run): D1={d1:,}, LLd={lld:,}\n")

    plt.figure(figsize=(11, 7))
    ax = plt.gca()

    plt.plot(DEGREES, ptr_d1, marker='o', color='#D62728', linestyle='-', linewidth=2, label='Pointer D1 Misses')
    annotate_integer_points(DEGREES, ptr_d1, ax, 6)
    
    plt.plot(DEGREES, csr_d1, marker='s', color='#1F77B4', linestyle='-', linewidth=2, label='CSR D1 Misses')
    annotate_integer_points(DEGREES, csr_d1, ax, -12)

    plt.plot(DEGREES, ptr_lld, marker='o', color='#FF9896', linestyle='--', linewidth=2, label='Pointer LLd Misses')
    annotate_integer_points(DEGREES, ptr_lld, ax, 6)
    
    plt.plot(DEGREES, csr_lld, marker='s', color='#AEC7E8', linestyle='--', linewidth=2, label='CSR LLd Misses')
    annotate_integer_points(DEGREES, csr_lld, ax, -12)

    plt.title(f'Cache Misses vs. Graph Density (N={GRAPH_N})', fontsize=14)
    plt.xlabel('Graph Degree (Edges per Vertex)', fontsize=12)
    plt.ylabel('Cache Misses (Averaged over 25 runs)', fontsize=12)
    
    ax.yaxis.set_major_formatter(FuncFormatter(format_thousands))
    
    plt.grid(True, which="major", ls="--", alpha=0.6)
    plt.legend(fontsize=11)
    plt.tight_layout()
    
    filename = 'cache_misses_by_degree_fixed.png'
    plt.savefig(filename, dpi=300)
    print(f"Saved combined plot to '{filename}'.")

if __name__ == "__main__":
    main()