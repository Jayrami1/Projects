#include "BranchPredictor.h"
BranchPredictor::BranchPredictor(){
    //initialize an array for up to 4096 instructions, and each taken initially
    state_array.assign(4096, 0); 
}
int BranchPredictor::predict(int current_pc, int imm, OpCode op){
    if (current_pc >= (int)state_array.size()) {    // To extend if inst > state_array
        state_array.resize(current_pc + 1024, 0);
    }
    int state = state_array[current_pc];
    // State 0 and 1 -> Predict taken
    if (state == 0 || state == 1) {
        return current_pc + imm; 
    } 
    // State 2 and 3 -> Predict not taken
    else {
        return current_pc + 1;
    }
}
void BranchPredictor::update(int pc, int actual_target, bool taken, bool was_correct){
    total_branches++;
    if (was_correct) {
        correct_predictions++;
    }
    if (pc >= (int)state_array.size()) {
        state_array.resize(pc + 1024, 0);
    }
    int state = state_array[pc];
    // 2bit predict branch transitions
    if (taken) {
        if (state == 1) state_array[pc] = 0;
        else if (state == 2) state_array[pc] = 1;
        else if (state == 3) state_array[pc] = 2;
        // if state == 0, it stays 0 already max taken
    } else {
        if (state == 0) state_array[pc] = 1;
        else if (state == 1) state_array[pc] = 2;
        else if (state == 2) state_array[pc] = 3;
        // if state == 3, it stays 3 already max not taken
    }
}