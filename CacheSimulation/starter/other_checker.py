import os
import sys
import math
import subprocess
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

# Configuration
SIZES = [10000, 90000, 250000, 490000, 722500, 1000000]
KINDS = ['chain', 'star', 'grid']
DATA_DIR = "data"

REPEATS = {
    10000: 50,
    90000: 25,
    250000: 15,
    490000: 10,
    722500: 10,
    1000000: 10
}

def run_cmd(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error executing: {' '.join(cmd)}")
        print(result.stderr)
        sys.exit(1)
    return result.stdout

def extract_time(stdout):
    for line in stdout.splitlines():
        if line.startswith("time_ms="):
            return float(line.split('=')[1])
    return 0.0

def format_thousands(x, pos):
    if x >= 1e6:
        return f'{x*1e-6:g}M'
    elif x >= 1e3:
        return f'{x*1e-3:g}k'
    return f'{x:g}'

def annotate_points(x_vals, y_vals, ax, offset_y):
    """Adds precise float values next to each point"""
    for x, y in zip(x_vals, y_vals):
        ax.annotate(f"{y:.2f}", (x, y), textcoords="offset points", xytext=(0, offset_y), ha='center', fontsize=8, alpha=0.8)

def finalize_and_save(filename, title, x_vals, ptr_y, csr_y):
    plt.title(title)
    plt.xlabel('Graph Size (Number of Vertices)')
    plt.ylabel('Average Execution Time (ms)')
    
    ax = plt.gca()
    ax.xaxis.set_major_formatter(FuncFormatter(format_thousands))
    
    # Add coordinates
    annotate_points(x_vals, ptr_y, ax, offset_y=6)
    annotate_points(x_vals, csr_y, ax, offset_y=-12)
    
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

    results = {kind: {'pointer': [], 'csr': []} for kind in KINDS}

    # 1. Run Benchmarks
    for kind in KINDS:
        for n in SIZES:
            graph_path = os.path.join(DATA_DIR, f"{kind}_n{n}.txt")
            repeats = REPEATS[n]
            
            print(f"Generating {kind} graph (N={n})...")
            gen_cmd = ["python3", "scripts/gen_graph.py", "--kind", kind, "--out", graph_path]
            
            if kind == 'grid':
                side = int(math.sqrt(n))
                gen_cmd.extend(["--rows", str(side), "--cols", str(side)])
            else:
                gen_cmd.extend(["--n", str(n)])
            
            run_cmd(gen_cmd)
            
            print(f"  Running pointer BFS ({repeats} repeats)...")
            ptr_out = run_cmd(["./graph_bench", "--impl=pointer", f"--graph={graph_path}", "--source=0", f"--repeat={repeats}"])
            ptr_time = extract_time(ptr_out) / repeats
            results[kind]['pointer'].append(ptr_time)
            
            print(f"  Running CSR BFS ({repeats} repeats)...")
            csr_out = run_cmd(["./graph_bench", "--impl=csr", f"--graph={graph_path}", "--source=0", f"--repeat={repeats}"])
            csr_time = extract_time(csr_out) / repeats
            results[kind]['csr'].append(csr_time)

    # 2. Plotting Results
    print("\nGenerating linear plots...")

    plt.figure(figsize=(9, 6))
    plt.plot(SIZES, results['chain']['pointer'], marker='o', linestyle='-', color='red', label='Pointer')
    plt.plot(SIZES, results['chain']['csr'], marker='s', linestyle='-', color='blue', label='CSR')
    finalize_and_save('simple_benchmark_chain.png', 'Chain Graph Performance: Pointer vs CSR', SIZES, results['chain']['pointer'], results['chain']['csr'])

    plt.figure(figsize=(9, 6))
    plt.plot(SIZES, results['star']['pointer'], marker='o', linestyle='-', color='red', label='Pointer')
    plt.plot(SIZES, results['star']['csr'], marker='s', linestyle='-', color='blue', label='CSR')
    finalize_and_save('simple_benchmark_star.png', 'Star Graph Performance: Pointer vs CSR', SIZES, results['star']['pointer'], results['star']['csr'])

    plt.figure(figsize=(9, 6))
    plt.plot(SIZES, results['grid']['pointer'], marker='o', linestyle='-', color='red', label='Pointer')
    plt.plot(SIZES, results['grid']['csr'], marker='s', linestyle='-', color='blue', label='CSR')
    finalize_and_save('simple_benchmark_grid.png', 'Grid Graph Performance: Pointer vs CSR', SIZES, results['grid']['pointer'], results['grid']['csr'])

    print("\nAll experiments complete!")

if __name__ == "__main__":
    main()