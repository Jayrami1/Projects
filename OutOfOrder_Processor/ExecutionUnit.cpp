#include "ExecutionUnit.h"

void ExecutionUnit::flush(){
    //clear output flags
    has_result = false;
    has_exception = false;
    broadcastTag = -1;
    broadcastVal = 0;
    pipeline.clear(); // Wipe the internal pipeline
    for (auto& entry : rs_entries) {
        entry.free_now = false;
        entry.busy = false;
        entry.rht = -1;
        entry.lht = -1;
        entry.dest_tag = -1;
    }
}

void ExecutionUnit::capture(int tag,int val){   //Snooping unit on CDB for reservation station checks
    for (auto& entry : rs_entries) {
        if (entry.busy) {
            if (entry.lht == tag) {
                entry.lhv = val;
                entry.lht = -1; //-1 means ready
            }
            if (entry.rht == tag) {
                entry.rhv = val;
                entry.rht = -1;
            }
        }
    }
}

void ExecutionUnit::executeCycle() {
    has_result = false;
    //issue one ready instruction into the pipeline(Out-Of-Order)
    RSEntry* oldest_ready = nullptr;
    for (auto& entry : rs_entries) {
        if (entry.busy && entry.lht == -1 && entry.rht == -1) {
            //check if its already in the pipeline computing
            bool already_executing = false;
            for (const auto& p : pipeline) {
                if (p.tag == entry.dest_tag) { already_executing = true; break; }
            }
            if (!already_executing) {
                if (oldest_ready == nullptr || entry.issue_id < oldest_ready->issue_id) {
                    oldest_ready = &entry;
                }
            }
        }
    }
    if (oldest_ready) {
        pipeline.push_back({oldest_ready->dest_tag, latency});
    }
    //advance all instructions currently in the pipeline
    for (auto it = pipeline.begin(); it != pipeline.end(); ) {
        it->remaining_cycles--;
        if (it->remaining_cycles <= 0) {
            has_result = true;  //inst done computing
            broadcastTag = it->tag;
            RSEntry* executing_rs = nullptr;    // finding corresponding RSentry
            for (auto& entry : rs_entries) {
                if (entry.busy && entry.dest_tag == it->tag) {
                    executing_rs = &entry;
                    break;
                }
            }
            if (executing_rs) {
                long long ans = 0; 
                has_exception = false;
                switch (executing_rs->op) {
                    case OpCode::ADD: ans = (long long)executing_rs->lhv + executing_rs->rhv; break;
                    case OpCode::ADDI: ans = (long long)executing_rs->lhv + executing_rs->imm; break;
                    case OpCode::SUB: ans = (long long)executing_rs->lhv - executing_rs->rhv; break;
                    case OpCode::MUL: ans = (long long)executing_rs->lhv * executing_rs->rhv; break;
                    case OpCode::DIV:   // chances of exception against zero
                        if (executing_rs->rhv == 0) has_exception = true;
                        else ans = (long long)executing_rs->lhv / executing_rs->rhv; 
                        break;
                    case OpCode::REM:   // chances of exception against zero
                        if (executing_rs->rhv == 0) has_exception = true;
                        else ans = (long long)executing_rs->lhv % executing_rs->rhv; 
                        break;
                    case OpCode::SLT: ans = (executing_rs->lhv<executing_rs->rhv) ? 1 : 0; break;
                    case OpCode::SLTI: ans = (executing_rs->lhv<executing_rs->imm) ? 1 : 0; break;
                    case OpCode::AND: ans = executing_rs->lhv&executing_rs->rhv; break;
                    case OpCode::ANDI: ans = executing_rs->lhv&executing_rs->imm; break;
                    case OpCode::OR: ans = executing_rs->lhv|executing_rs->rhv; break;
                    case OpCode::ORI: ans = executing_rs->lhv|executing_rs->imm; break;
                    case OpCode::XOR: ans = executing_rs->lhv^executing_rs->rhv; break;
                    case OpCode::XORI: ans = executing_rs->lhv^executing_rs->imm; break;
                    case OpCode::BEQ: ans = (executing_rs->lhv==executing_rs->rhv) ? 1 : 0; break;
                    case OpCode::BNE: ans = (executing_rs->lhv!=executing_rs->rhv) ? 1 : 0; break;
                    case OpCode::BLT: ans = (executing_rs->lhv<executing_rs->rhv) ? 1 : 0; break;
                    case OpCode::BLE: ans = (executing_rs->lhv<=executing_rs->rhv) ? 1 : 0; break;
                    default: break;
                }
                if (executing_rs->op == OpCode::ADD || executing_rs->op == OpCode::SUB || 
                    executing_rs->op == OpCode::ADDI || executing_rs->op == OpCode::MUL || 
                    executing_rs->op == OpCode::DIV || executing_rs->op == OpCode::REM) {
                    long long max_val = 2147483647LL;
                    long long min_val = -2147483648LL;  // min and max defined as -2^31 to 2^31 -1;
                    if (ans > max_val || ans < min_val) {
                        has_exception = true;
                    }
                }
                broadcastVal = (int)ans;
                executing_rs->busy = false; // releasing rsentry
                executing_rs->free_now=true;
            }
            it = pipeline.erase(it); //remove from pipeline
        } else {
            ++it;
        }
    }   
}