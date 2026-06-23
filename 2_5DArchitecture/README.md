# 2.5D Thermal Architecture Simulation

## Overview
This repository contains the steady-state thermal simulation data and visual analysis for a 2.5D integrated circuit (IC) architecture. By simulating the thermal dynamics across six distinct vertical layers—from the base die up to the heatsink—this project models how heat propagates through advanced 2.5D packaging. 

The goal of this project is to map thermal resistance and capacitance across physical boundaries to identify bottlenecks and optimize future floorplanning and material choices.

## Architectural Design & Heat Flow
Traditional 2D chips primarily dissipate heat upwards. In contrast, our 2.5D architecture requires modeling heat as a fluid dynamic moving in three dimensions. The architecture is divided into 6 physical layers (Layers 0–5), and we designed our analysis to track three distinct thermal paths:

1.  **The Primary Vertical Escape (Upward Flow):** * *Path:* Active Silicon $\rightarrow$ Shim $\rightarrow$ TIM $\rightarrow$ Heatsink
    * *Insight:* Maps the intended cooling path. We track the temperature drop ($\Delta T$) across the Shim and Thermal Interface Material (TIM) to evaluate vertical thermal resistance.
2.  **The Downward Thermal Soak (Downward Flow):** * *Path:* Active Silicon $\rightarrow$ Interposer $\rightarrow$ Base Die
    * *Insight:* Captures how the bottom silicon layers act as a thermal sponge. High steady-state temperatures here indicate the need for optimized Through-Silicon Via (TSV) placement to channel heat safely.
3.  **Lateral Heat Bleed (Horizontal Flow):**
    * *Path:* High-Power Cores $\rightarrow$ Intermediate Silicon $\rightarrow$ Local Caches
    * *Insight:* Tracks how heat from the processing cores (~1662 units) invades cooler SRAM/Cache regions (~393 units). This data is critical for optimizing horizontal floorplanning and placing "dark silicon" buffers.

## Directory Structure
The repository is organized layer-by-layer, allowing you to trace the exact thermal state at any vertical cross-section of the package.

```text
├── layer_0_Base_Die/      # Bottom layer thermal soak. Shows uniform high temperatures absorbing downward radiation.
├── layer_1_Interposer/    # The silicon interposer bridging the base die and active silicon.
├── layer_2_Active_Silicon/# The primary logic layer. Contains peak temperatures for Cores (C0-C3) and cooler zones for Caches (LC0-LC3).
├── layer_3_Shim/          # Structural/thermal shim data showing the first stage of upward thermal mitigation.
├── layer_4_TIM/           # Thermal Interface Material logs. Shows massive temperature drops as heat approaches the cooling solution.
├── layer_5_Heatsink/      # Final cooling layer (Base, Spreader, and Fins).
├── grids_raw/             # Raw spatial grid dumps (e.g., 2_5D.grid.steady) mapping XY coordinates to thermal values.
└── visualizations/        # Rendered heatmaps and overlays (e.g., 2_5D_layer0.grid.steady0, 2_5D_TIM.png, 2_5D_overlay.png).
