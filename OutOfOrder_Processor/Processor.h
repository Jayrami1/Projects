#pragma once
#include <iostream>
#include <fstream>
#include <vector>
#include <iomanip>
#include "Basics.h"
#include "BranchPredictor.h"
#include "ExecutionUnit.h"
#include "LoadStoreQueue.h"
#include <unordered_map>
#include <algorithm>
class Processor {
public:
    int pc;
    int clock_cycle;

    // pipeline registers
    std::vector<Instruction> inst_memory;
    // architectural state (do not change)
    std::vector<int> ARF; // regFile
    std::vector<int> Memory; // Memory
    bool exception = false; // exception bit
    // register alias table / reorder buffer
    std::vector<int> RAT; //maps register ID to ROB index. -1 means value is in ARF.
    std::vector<ROBEntry> ROB;//basically implementation of circular queue
    int rob_head; //points to the oldest instruction(to be committed)
    int rob_tail; //points to the next free allocation slot(to be added here)
    int rob_count; //number of active instructions in ROB
    std::vector<ExecutionUnit> units;
    LoadStoreQueue* lsq;
    BranchPredictor bp;
    // pipeline registers
    Instruction fetched_instruction;
    bool has_fetched_inst = false;
    long long global_issue_id = 0;
    bool flushed_this_cycle = false;
    Processor(ProcessorConfig& config);
    ~Processor();
    void loadProgram(const std::string& filename);

    void flush();

    void broadcastOnCDB();

    void stageFetch();

    void stageDecode();

    void stageExecuteAndBroadcast();

    void stageCommit();

    bool step();

    void dumpArchitecturalState();
};