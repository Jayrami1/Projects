import os
import sys
import subprocess
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

DATA_DIR = "data"
GRAPH_N = 10000
GRAPH_DEG = 8
GRAPH_PATH = os.path.join(DATA_DIR, f"tuning_er_n{GRAPH_N}_deg{GRAPH_DEG}.txt")

BASE_SIZE = 32768  # 32 KB
BASE_ASSOC = 8     # 8-way
BASE_LINE = 64     # 64 bytes

SIZES = [8192, 16384, 32768, 65536, 131072]  
ASSOCS = [1, 2, 4, 8, 16]                    
LINES = [32, 64, 128, 256, 512]               

def run_cmd(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error executing: {' '.join(cmd)}")
        print(result.stderr)
        sys.exit(1)
    return result

def run_cachegrind(impl, size, assoc, line):
    for f in os.listdir('.'):
        if f.startswith('cachegrind.out.'):
            os.remove(f)

    # FIXED: Apply the 'line' variable to I1, D1, and LL caches 
    # to prevent Valgrind from crashing due to mismatched cache line architectures.
    cmd = [
        "valgrind", 
        "--tool=cachegrind", 
        "--cache-sim=yes",
        f"--I1=32768,8,{line}",           
        f"--D1={size},{assoc},{line}", 
        f"--LL=1048576,16,{line}",        
        "./graph_bench", 
        f"--impl={impl}", 
        f"--graph={GRAPH_PATH}", 
        "--source=0", 
        "--repeat=25" 
    ]
    
    subprocess.run(cmd, capture_output=True, text=True)
    
    # ... rest of the function to parse the generated cachegrind.out file
    
    cg_file = None
    for f in os.listdir('.'):
        if f.startswith('cachegrind.out.'):
            cg_file = f
            break
            
    if not cg_file:
        print(f"\n[!] Valgrind failed to produce output file for {impl} ({size},{assoc},{line})")
        return 0
        
    events = []
    summary = []
    with open(cg_file, 'r') as f:
        for text_line in f:
            if text_line.startswith('events:'):
                events = text_line.strip().split()[1:]
            elif text_line.startswith('summary:'):
                summary = text_line.strip().split()[1:]
                
    if not events or not summary:
        print(f"\n[!] Failed to find summary data in {cg_file}.")
        return 0
        
    data = dict(zip(events, summary))
    d1_misses = 0
    if 'D1mr' in data: d1_misses += int(data['D1mr'])
    if 'D1mw' in data: d1_misses += int(data['D1mw'])
    
    return d1_misses // 25

def format_thousands(x, pos):
    if x >= 1e6: return f'{x*1e-6:g}M'
    elif x >= 1e3: return f'{x*1e-3:g}k'
    return f'{x:g}'

def annotate_integer_points(x_vals, y_vals, ax, offset_y):
    """Adds precise integer values (with commas) next to each point"""
    for x, y in zip(x_vals, y_vals):
        ax.annotate(f"{y:,}", (x, y), textcoords="offset points", xytext=(0, offset_y), ha='center', fontsize=8, alpha=0.8)

def plot_experiment(x_values, ptr_misses, csr_misses, title, xlabel, filename, is_log_x=False):
    plt.figure(figsize=(10, 7))
    plt.plot(x_values, ptr_misses, marker='o', color='red', label='Pointer D1 Misses')
    plt.plot(x_values, csr_misses, marker='s', color='blue', label='CSR D1 Misses')
    
    plt.title(title)
    plt.xlabel(xlabel)
    plt.ylabel('D1 Cache Misses')
    
    if is_log_x:
        plt.xscale('log', base=2)
        plt.xticks(x_values, [str(x) for x in x_values])
        
    ax = plt.gca()
    ax.yaxis.set_major_formatter(FuncFormatter(format_thousands))
    
    annotate_integer_points(x_values, ptr_misses, ax, offset_y=8)
    annotate_integer_points(x_values, csr_misses, ax, offset_y=-14)
    
    plt.grid(True, which="major", ls="--", alpha=0.7)
    plt.legend()
    plt.tight_layout()
    plt.savefig(filename, dpi=300)
    plt.close()
    print(f"Saved plot to '{filename}'.")

def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    print("Building project...")
    run_cmd(["make"])

    print(f"\nGenerating Target Graph (ER, N={GRAPH_N}, deg={GRAPH_DEG})...")
    if not os.path.exists(GRAPH_PATH):
        run_cmd(["python3", "scripts/gen_graph.py", "--kind", "er", "--n", str(GRAPH_N), "--deg", str(GRAPH_DEG), "--seed", "1", "--out", GRAPH_PATH])

    print("\nStarting Cachegrind Tuning Experiments (This may take a minute)...\n")

    print(f"--- Exp 1: Varying Cache Size (Assoc={BASE_ASSOC}, Line={BASE_LINE}) ---")
    ptr_sz, csr_sz = [], []
    for s in SIZES:
        print(f"  Testing Size: {s//1024} KB...")
        ptr_sz.append(run_cachegrind("pointer", s, BASE_ASSOC, BASE_LINE))
        csr_sz.append(run_cachegrind("csr", s, BASE_ASSOC, BASE_LINE))
    
    plot_experiment(SIZES, ptr_sz, csr_sz, 
                    "D1 Cache Misses vs. Total Cache Size", "Cache Size (Bytes)", 
                    "cache_tuning_size.png", is_log_x=True)

    print(f"\n--- Exp 2: Varying Associativity (Size={BASE_SIZE}, Line={BASE_LINE}) ---\n")
    ptr_assoc, csr_assoc = [], []
    for a in ASSOCS:
        print(f"  Testing {a}-way Associativity...")
        ptr_assoc.append(run_cachegrind("pointer", BASE_SIZE, a, BASE_LINE))
        csr_assoc.append(run_cachegrind("csr", BASE_SIZE, a, BASE_LINE))
        
    plot_experiment(ASSOCS, ptr_assoc, csr_assoc, 
                    "D1 Cache Misses vs. Cache Associativity", "Ways of Associativity", 
                    "cache_tuning_assoc.png", is_log_x=True)

    print(f"\n--- Exp 3: Varying Line Size (Size={BASE_SIZE}, Assoc={BASE_ASSOC}) ---\n")
    ptr_line, csr_line = [], []
    for l in LINES:
        print(f"  Testing Line Size: {l} Bytes...")
        ptr_line.append(run_cachegrind("pointer", BASE_SIZE, BASE_ASSOC, l))
        csr_line.append(run_cachegrind("csr", BASE_SIZE, BASE_ASSOC, l))
        
    plot_experiment(LINES, ptr_line, csr_line, 
                    "D1 Cache Misses vs. Cache Line Size", "Line Size (Bytes)", 
                    "cache_tuning_line.png", is_log_x=True)

    print("\nAll Cachegrind experiments complete!")

if __name__ == "__main__":
    main()