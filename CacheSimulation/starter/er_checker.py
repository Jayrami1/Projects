import os
import sys
import subprocess
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

DATA_DIR = "data"

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
    if x >= 1e6: return f'{x*1e-6:g}M'
    elif x >= 1e3: return f'{x*1e-3:g}k'
    return f'{x:g}'

def annotate_points(x_vals, y_vals, ax, offset_y):
    """Adds precise float values next to each point"""
    for x, y in zip(x_vals, y_vals):
        ax.annotate(f"{y:.2f}", (x, y), textcoords="offset points", xytext=(0, offset_y), ha='center', fontsize=8, alpha=0.8)

def finalize_and_save(filename, title, xlabel, x_vals, ptr_y, csr_y):
    plt.title(title)
    plt.xlabel(xlabel)
    plt.ylabel('Average Execution Time (ms)')
    ax = plt.gca()
    ax.xaxis.set_major_formatter(FuncFormatter(format_thousands))
    
    annotate_points(x_vals, ptr_y, ax, offset_y=6)
    annotate_points(x_vals, csr_y, ax, offset_y=-12)
    
    plt.grid(True, which="major", ls="--", alpha=0.7)
    plt.legend()
    plt.tight_layout()
    plt.savefig(filename, dpi=300)
    plt.close()
    print(f"Saved plot to '{filename}'.\n")

def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    print("Building project...")
    run_cmd(["make"])

    print("\n--- EXPERIMENT 1: Scaling Size at High Density (deg=100) ---")
    SIZES = [10000, 50000, 100000, 250000, 500000, 1000000]
    FIXED_DEG = 100
    
    exp1_ptr_times = []
    exp1_csr_times = []

    for n in SIZES:
        repeats = 10 
        graph_path = os.path.join(DATA_DIR, f"dense_n{n}_deg{FIXED_DEG}.txt")
        
        print(f"Generating dense ER graph (N={n}, deg={FIXED_DEG})...")
        run_cmd(["python3", "scripts/gen_graph.py", "--kind", "er", "--n", str(n), "--deg", str(FIXED_DEG), "--seed", "1", "--out", graph_path])
        
        ptr_out = run_cmd(["./graph_bench", "--impl=pointer", f"--graph={graph_path}", "--source=0", f"--repeat={repeats}"])
        exp1_ptr_times.append(extract_time(ptr_out) / repeats)
        
        csr_out = run_cmd(["./graph_bench", "--impl=csr", f"--graph={graph_path}", "--source=0", f"--repeat={repeats}"])
        exp1_csr_times.append(extract_time(csr_out) / repeats)

    plt.figure(figsize=(9, 6))
    plt.plot(SIZES, exp1_ptr_times, marker='o', color='red', label='Pointer')
    plt.plot(SIZES, exp1_csr_times, marker='s', color='blue', label='CSR')
    finalize_and_save('csr_victory_scale_n.png', f'High Density Graph (Degree {FIXED_DEG}): Pointer vs CSR', 'Graph Size (Number of Vertices)', SIZES, exp1_ptr_times, exp1_csr_times)

    print("--- EXPERIMENT 2: Scaling Density at Fixed Size (N=100k) ---")
    FIXED_N = 100000
    DEGREES = [10, 50, 100, 200, 350, 500]
    
    exp2_ptr_times = []
    exp2_csr_times = []

    for deg in DEGREES:
        repeats = 10
        graph_path = os.path.join(DATA_DIR, f"dense_n{FIXED_N}_deg{deg}.txt")
        
        print(f"Generating ER graph (N={FIXED_N}, deg={deg})...")
        run_cmd(["python3", "scripts/gen_graph.py", "--kind", "er", "--n", str(FIXED_N), "--deg", str(deg), "--seed", "1", "--out", graph_path])
        
        ptr_out = run_cmd(["./graph_bench", "--impl=pointer", f"--graph={graph_path}", "--source=0", f"--repeat={repeats}"])
        exp2_ptr_times.append(extract_time(ptr_out) / repeats)
        
        csr_out = run_cmd(["./graph_bench", "--impl=csr", f"--graph={graph_path}", "--source=0", f"--repeat={repeats}"])
        exp2_csr_times.append(extract_time(csr_out) / repeats)

    plt.figure(figsize=(9, 6))
    plt.plot(DEGREES, exp2_ptr_times, marker='o', color='red', label='Pointer')
    plt.plot(DEGREES, exp2_csr_times, marker='s', color='blue', label='CSR')
    finalize_and_save('csr_victory_scale_deg.png', f'Density Scaling (N={FIXED_N}): Pointer vs CSR', 'Graph Degree (Edges per Vertex)', DEGREES, exp2_ptr_times, exp2_csr_times)

    print("All dense benchmark experiments complete!")

if __name__ == "__main__":
    main()