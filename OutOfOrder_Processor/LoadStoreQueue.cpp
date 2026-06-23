#include "LoadStoreQueue.h"
void LoadStoreQueue::flush(){
    //clear output flags
    has_result = false;
    has_exception = false;
    store_data = 0;
    broadcastTag = -1;
    broadcastVal = 0;
    pipeline.clear(); //wipe the internal pipeline
    for (auto& entry : lsq_entries) {
        entry.free_now = false;
        entry.busy = false;
        entry.rht = -1;
        entry.lht = -1;
        entry.dest_tag = -1;
    }
}

void LoadStoreQueue::capture(int tag,int val){
    for (auto& entry : lsq_entries) {
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

void LoadStoreQueue::executeCycle(std::vector<int>& Memory, const std::vector<ROBEntry>& ROB, int rob_head, int rob_count) {
    has_result = false;
    //issue oldest unissued instruction
    RSEntry* oldest_unissued = nullptr;
    for (auto& entry : lsq_entries) {
        if (entry.busy) {
            bool in_pipe = false;
            for (const auto& p : pipeline) {
                if (p.tag == entry.dest_tag) { in_pipe = true; break; }
            }
            if (!in_pipe) {
                if (oldest_unissued == nullptr || entry.issue_id < oldest_unissued->issue_id) {
                    oldest_unissued = &entry;
                }
            }
        }
    }
    if (oldest_unissued != nullptr) {
        if (oldest_unissued->lht == -1 && oldest_unissued->rht == -1) {
            pipeline.push_back({oldest_unissued->dest_tag, latency});
        }
    }
    //advance all instructions currently in the pipeline
    for (auto it = pipeline.begin(); it != pipeline.end(); ) {
        it->remaining_cycles--;
        if (it->remaining_cycles <= 0) {
            has_result = true;
            broadcastTag = it->tag;
            RSEntry* executing_rs = nullptr;
            for (auto& entry : lsq_entries) {
                if (entry.busy && entry.dest_tag == it->tag) {
                    executing_rs = &entry;
                    break;
                }
            }
            if (executing_rs) {
                has_exception = false;
                int address = executing_rs->lhv + executing_rs->imm; 
                
                if (address < 0 || address >= (int)Memory.size()) {
                    has_exception = true;
                    broadcastVal = 0;
                } else {
                    if (executing_rs->op == OpCode::LW) {
                        int final_val = Memory[address];
                        // STORE-TO-LOAD FORWARDING:
                        //scan ROB from head up to our current tag to find the latest uncommitted SW
                        for (int i = 0; i < rob_count; i++) {
                            int idx = (rob_head + i) % ROB.size();
                            if (idx == executing_rs->dest_tag) break; //stop when we reach ourselves 
                            //if an older instruction is a Store Word targeting our exact address
                            if (ROB[idx].dest_reg == -1 && !ROB[idx].is_branch && ROB[idx].mem_addr == address) {
                                final_val = ROB[idx].value; // Forward the value!
                            }
                        }
                        broadcastVal = final_val;
                    } else if (executing_rs->op == OpCode::SW) {
                        broadcastVal = address; 
                        store_data = executing_rs->rhv; 
                    }
                }
                executing_rs->free_now=true;
                executing_rs->busy = false;
            }
            it = pipeline.erase(it);
        } else {
            ++it;
        }
    }
}