#pragma once
#include <string>

enum class OpCode { ADD, SUB, ADDI, MUL, DIV, REM, LW, SW, BEQ, BNE, BLT, BLE, J, SLT, SLTI, AND, OR, XOR, ANDI, ORI, XORI };
enum class UnitType { ADDER, MULTIPLIER, DIVIDER, LOADSTORE, BRANCH, LOGIC };

struct Instruction {
    OpCode op;
    int dest;
    int src1;
    int src2;
    int imm;
    int pc;
};

struct ProcessorConfig {
    int num_regs = 32;
    int rob_size = 64;
    int mem_size = 1024;

    int logic_lat = 1;
    int add_lat = 2;
    int mul_lat = 4;
    int div_lat = 5;
    int mem_lat = 4;

    int logic_rs_size = 4;
    int adder_rs_size = 4;
    int mult_rs_size = 2;
    int div_rs_size = 2;
    int br_rs_size = 2;
    int lsq_rs_size = 32;
};

struct ROBEntry {
    // valid bit, ready bit, architectural register ID
    // other fields as required
    bool valid = false;         //entry currently allocated?
    bool ready = false;         //finished executing?
    int dest_reg = -1;          //regId to be updated
    int value = 0;              //the computed value to write back
    
    //memory and branching
    int mem_addr = -1;          //target address for store instructions
    bool is_branch = false;     //true if the instruction is a branch(will make a 2bit MC for this later on)
    bool branch_taken = false;  //actual branch outcome
    bool pred_taken = false;    //predicted branch outcome
    int actual_target = 0;      //actual PC to jump to if branch taken
    // Exception handling
    int pc = -1;            
    bool exception = false;     //caused exeption or not
};

struct RSEntry {
    // value, tag, ready ... for both operands
    // other fields as required
    bool busy = false;          //station occupied??
    OpCode op;                  //operation to perform
    int lhv = 0, rhv = 0;         //actual values of source operands
    int lht = -1, rht = -1;       //ROB tags if values are not yet ready
    int imm = 0;                //immediate value
    int dest_tag = -1;          //the ROB entry index allocated for this instruction
    int pc = -1;
    long long issue_id = 0;
    bool free_now = false;// added  cuz rs entry gets freed but then used again in same cycle which is not admirable
};