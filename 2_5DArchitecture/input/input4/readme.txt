This is interposer only folder.
Assumptions and changes I made:

Resistivity for Gap Filler blocks (X1, X2, X3 and X1_shim, X2_shim, X3_shim) was set to 100.0.
In the Shim Layer (layer2_shim.flp), the support blocks directly above the CPU (SHIM_C0_0 to SHIM_C3_3) were set to 100.0 resistivity.
The shims above the HBM memory (LC0_0_shim to LC3_3_shim) were kept at 0.01 resistivity (Silicon).
Layer 0 (Base Die) was set to Vertical Flow = N in the .lcf to prevent heat from sinking into the bottom-most silicon.

The side-by-side thermal maps clearly show heat travelling from CPU to interposer and then to HBM but since interposer is very thin, it acts a bottleneck for heat transfer leading to exttreme temperatures. Thus not primary heat flow path to HBM but still somewhat passes.
