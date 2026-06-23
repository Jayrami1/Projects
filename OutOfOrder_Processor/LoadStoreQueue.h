#pragma once
#include <iostream>
#include <vector>
#include <string>
#include "Basics.h"
struct LSQOngInst{
    int tag;
    int remaining_cycles;
};
class LoadStoreQueue {
public:
    // LSQ reservation station
    int latency;
    
    bool has_result = false; // result flag
    bool has_exception = false; // exception flag
    int store_data = 0;
    int broadcastTag = -1;
    int broadcastVal = 0;

    //the Queue entries
    std::vector<RSEntry> lsq_entries;
    std::vector<LSQOngInst>pipeline;
    //state of the currently executing memory instruction
    void flush() ;
    void capture(int tag, int val) ;
    void executeCycle(std::vector<int>& Memory, const std::vector<ROBEntry>& ROB, int rob_head, int rob_count);
};