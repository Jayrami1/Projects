#pragma once
#include "Basics.h"
#include <iostream>
#include <vector>

class BranchPredictor {
public:
    int total_branches = 0;
    int correct_predictions = 0;
    //array to hold the state for each PC.
    // 0: Strongly Taken, 1: Weakly Taken, 2: Weakly Not Taken, 3: Strongly Not Taken
    std::vector<int> state_array;
    BranchPredictor();
    int predict(int current_pc, int imm, OpCode op);
    void update(int pc, int actual_target, bool taken, bool was_correct);
};