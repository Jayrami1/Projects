#pragma once
#include <iostream>
#include <vector>
#include <string>
#include "Basics.h"
struct OngInst{
    int tag;
    int remaining_cycles;
};
class ExecutionUnit {
public:
    // per-unit reservation station
    UnitType name;
    int latency;
    bool has_result = false;
    bool has_exception = false;
    int broadcastTag = -1;
    int broadcastVal = 0;
    std::vector<OngInst> pipeline;
    // The Reservation Stations for this specific unit
    std::vector<RSEntry> rs_entries;
    void flush() ;
    void capture(int tag, int val) ;
    void executeCycle() ;
};