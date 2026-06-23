#include "Processor.h"
#include <fstream>
#include <sstream>
#include <iomanip>
#include <unordered_map>
#include <algorithm>

static const std::unordered_map<std::string, OpCode> opmap = {
    {"lw", OpCode::LW}, {"sw", OpCode::SW},{"add", OpCode::ADD}, {"sub", OpCode::SUB}, {"addi", OpCode::ADDI},
    {"mul", OpCode::MUL}, {"div", OpCode::DIV}, {"rem", OpCode::REM},{"slt", OpCode::SLT}, {"slti", OpCode::SLTI},
    {"and", OpCode::AND}, {"or", OpCode::OR}, {"xor", OpCode::XOR},
    {"andi", OpCode::ANDI}, {"ori", OpCode::ORI}, {"xori", OpCode::XORI},{"j", OpCode::J},
    {"beq", OpCode::BEQ}, {"bne", OpCode::BNE}, {"blt", OpCode::BLT}, {"ble", OpCode::BLE},
};
static UnitType getTargetUnit(OpCode op) {//specially for decode stage
    switch (op) {
        case OpCode::ADD: case OpCode::SUB: case OpCode::ADDI: 
        case OpCode::SLT: case OpCode::SLTI: return UnitType::ADDER;
        case OpCode::MUL: return UnitType::MULTIPLIER;
        case OpCode::DIV: case OpCode::REM: return UnitType::DIVIDER;
        case OpCode::AND: case OpCode::OR: case OpCode::XOR: 
        case OpCode::ANDI: case OpCode::ORI: case OpCode::XORI: return UnitType::LOGIC;
        case OpCode::BEQ: case OpCode::BNE: case OpCode::BLT: case OpCode::BLE: return UnitType::BRANCH;
        case OpCode::LW: case OpCode::SW: return UnitType::LOADSTORE;
        default: return UnitType::LOGIC;
    }
}
static int parser(const std::string& s) {
    if (s.empty() || s[0] != 'x') return 0;
    return std::stoi(s.substr(1));
}

Processor::Processor(ProcessorConfig& config) {
    pc = 0;
    clock_cycle = 0;
    ARF.resize(config.num_regs, 0);
    Memory.resize(config.mem_size, 0);
    RAT.assign(config.num_regs, -1);
    ROB.resize(config.rob_size);
    rob_head = 0;
    rob_tail = 0;
    rob_count = 0;
    
    // Instantiate Hardware Units and reservation station initialization
    ExecutionUnit adder{UnitType::ADDER, config.add_lat};
    adder.rs_entries.resize(config.adder_rs_size);
    units.push_back(adder);
    ExecutionUnit multi{UnitType::MULTIPLIER,config.mul_lat};
    multi.rs_entries.resize(config.mult_rs_size);
    units.push_back(multi);
    ExecutionUnit divi{UnitType::DIVIDER,config.div_lat};
    divi.rs_entries.resize(config.div_rs_size);
    units.push_back(divi);
    ExecutionUnit logi{UnitType::LOGIC,config.logic_lat};
    logi.rs_entries.resize(config.logic_rs_size);
    units.push_back(logi);
    ExecutionUnit bri{UnitType::BRANCH,config.add_lat};
    bri.rs_entries.resize(config.br_rs_size);
    units.push_back(bri);
    lsq = new LoadStoreQueue();
    lsq->latency = config.mem_lat;
    lsq->lsq_entries.resize(config.lsq_rs_size);
}

Processor::~Processor() {
    delete lsq;
}

void Processor::loadProgram(const std::string& filename) {
    std::ifstream file(filename);
    std::string line;
    int current_pc = 0;
    int current_mem_ptr = 0;
    while (std::getline(file, line)) {
        if (line.empty()) continue;
        if (line[0] == '.') {
            std::replace(line.begin(), line.end(), ':', ' ');
            std::stringstream ss(line);
            std::string label;
            ss >> label;
            int val;
            while (ss >> val && current_mem_ptr < Memory.size()) {
                Memory[current_mem_ptr++] = val;
            }
            continue; 
        }
        // replace commas and parentheses with spaces for easy parsing
        std::replace(line.begin(), line.end(), ',', ' ');
        std::replace(line.begin(), line.end(), '(', ' ');
        std::replace(line.begin(), line.end(), ')', ' ');
        std::stringstream ss(line);
        std::string op_str;
        
        // skip empty lines
        if (!(ss >> op_str)) continue;
        if (opmap.find(op_str) == opmap.end()) {
            continue; 
        }
        
        Instruction inst;
        inst.op = opmap.at(op_str);
        inst.pc = current_pc;
        inst.dest = 0; inst.src1 = 0; inst.src2 = 0; inst.imm = 0;
        
        std::string arg1, arg2, arg3;
        
        // parse arguments based on instruction type
        if (inst.op == OpCode::J) {
            ss >> arg1;
            inst.imm = std::stoi(arg1);
        } 
        else if (inst.op == OpCode::LW || inst.op == OpCode::SW) {
            ss >> arg1 >> arg2 >> arg3;
            if (inst.op == OpCode::LW) inst.dest = parser(arg1);
            else inst.src2 = parser(arg1);
            inst.imm = std::stoi(arg2);
            inst.src1 = parser(arg3);
        } 
        else if (inst.op >= OpCode::BEQ && inst.op <= OpCode::BLE) {
            ss >> arg1 >> arg2 >> arg3;
            inst.src1 = parser(arg1);
            inst.src2 = parser(arg2);
            inst.imm = std::stoi(arg3);
        } 
        else if (inst.op == OpCode::ADDI || inst.op == OpCode::SLTI || inst.op == OpCode::ANDI || inst.op == OpCode::ORI || inst.op == OpCode::XORI) {
            ss >> arg1 >> arg2 >> arg3;
            inst.dest = parser(arg1);
            inst.src1 = parser(arg2);
            inst.imm = std::stoi(arg3);
        } 
        else {
            ss >> arg1 >> arg2 >> arg3;
            inst.dest = parser(arg1);
            inst.src1 = parser(arg2);
            inst.src2 = parser(arg3);
        }
        inst_memory.push_back(inst);
        current_pc++;
    }
    file.close();
}

void Processor::flush() {
    rob_head = 0;
    rob_tail = 0;
    rob_count = 0;
    has_fetched_inst = false;
    flushed_this_cycle = true;
    // Clean out the ROB entries to prevent stale data from bleeding into future instructions
    for (auto& entry : ROB) {
        entry.valid = false;
        entry.ready = false;
        entry.exception = false;
        entry.is_branch = false;
        entry.dest_reg = -1;
    }
    //Reset the Register Alias Table (RAT)
    //setting everything to -1 means all architectural registers now map back to the ARF
    RAT.assign(RAT.size(), -1);
    //Flush all RS in the Execution Units
    for (auto& unit : units) {
        unit.flush(); 
    }
    //Flush the Load Store Queue
    if (lsq != nullptr) {
        lsq->flush();
    }
}

void Processor::stageFetch() {
    if (has_fetched_inst) {
        return; 
    }
    //check if PC is out of bounds (program finished)
    if (pc >= inst_memory.size()) {
        return;
    }
    //fetch the instruction
    fetched_instruction = inst_memory[pc];
    has_fetched_inst = true;
    //update PC using the Branch Predictor
    //branches and jump need prediction/calculation
    if (fetched_instruction.op >= OpCode::BEQ && fetched_instruction.op <= OpCode::BLE) {
        //use the branch predictor for conditional branches
        pc = bp.predict(pc, fetched_instruction.imm, fetched_instruction.op);
    } 
    else if (fetched_instruction.op == OpCode::J) {
        //unconditional jumps always jump
        pc = pc + fetched_instruction.imm;
    } 
    else {
        //standard instructions just move to the next sequential instruction
        pc = pc + 1;
    }
}

void Processor::stageDecode() {
    //check if there is an instruction to decode
    if (!has_fetched_inst) {
        return; 
    }
    //check if ROB is full. If so, STALL.
    if (rob_count == ROB.size()) {
        return; 
    }
    Instruction inst = fetched_instruction;
    //handle unconditional jumps separately
    if (inst.op == OpCode::J) {
        //allocate ROB entry
        int rob_idx = rob_tail;
        ROB[rob_idx].valid = true;
        ROB[rob_idx].ready = true; //jumps resolved in fetch and immediately ready
        ROB[rob_idx].pc = inst.pc;
        ROB[rob_idx].dest_reg = -1;
        ROB[rob_idx].is_branch = false; 
        ROB[rob_idx].mem_addr = -1;
        ROB[rob_idx].value = 0;
        //update ROB pointers
        rob_tail = (rob_tail + 1) % ROB.size();
        rob_count++;
        has_fetched_inst = false; //free fetch stage
        return;
    }
    //find the target Execution Unit and check if its Reservation Station has space
    UnitType target_type = getTargetUnit(inst.op);
    RSEntry* free_rs = nullptr;
    if (target_type == UnitType::LOADSTORE) {
        for (auto& entry : lsq->lsq_entries) {
            if (!entry.busy && !entry.free_now) { free_rs = &entry; break; }
        }
    } else {
        for (auto& unit : units) {
            if (unit.name == target_type) {
                for (auto& entry : unit.rs_entries) {
                    if (!entry.busy && !entry.free_now) { free_rs = &entry; break; }
                }
                break;
            }
        }
    }
    // If no free reservation station/LSQ entry, STALL.
    if (free_rs == nullptr) {
        return;
    }
    //allocate space for rob entry
    int rob_idx = rob_tail;
    ROB[rob_idx].valid = true;
    ROB[rob_idx].ready = false;
    ROB[rob_idx].pc = inst.pc;
    ROB[rob_idx].dest_reg = inst.dest;
    ROB[rob_idx].is_branch = (inst.op >= OpCode::BEQ && inst.op <= OpCode::BLE);
    ROB[rob_idx].exception = false;
    ROB[rob_idx].pred_taken = (inst.op >= OpCode::BEQ && inst.op <= OpCode::BLE) ? (bp.predict(inst.pc, inst.imm, inst.op)!= inst.pc+1) : false;
    ROB[rob_idx].mem_addr = -1;
    ROB[rob_idx].value = 0;
    //allocate rs entry and read operands
    free_rs->busy = true;
    free_rs->op = inst.op;
    free_rs->imm = inst.imm;
    free_rs->dest_tag = rob_idx;
    free_rs->pc = inst.pc;
    free_rs->issue_id = global_issue_id++;
    //source 1
    if (inst.src1 == 0) { // x0 is always 0
        free_rs->lhv = 0;
        free_rs->lht = -1;
    } else if (RAT[inst.src1] != -1) { //renamed, check ROB
        int tag = RAT[inst.src1];
        if (ROB[tag].ready) { // Already finished computing
            free_rs->lhv = ROB[tag].value;
            free_rs->lht = -1;
        } else { //wait for it on CDB
            free_rs->lht = tag;
        }
    } else { //read frm ARF
        free_rs->lhv = ARF[inst.src1];
        free_rs->lht = -1;
    }
    //read Source 2 (only if the instruction uses src2.)
    bool uses_src2 = !(inst.op == OpCode::ADDI || inst.op == OpCode::SLTI || 
                        inst.op == OpCode::ANDI || inst.op == OpCode::ORI || 
                        inst.op == OpCode::XORI || inst.op == OpCode::LW);
    if (uses_src2) {
        if (inst.src2 == 0) {
            free_rs->rhv = 0;
            free_rs->rht = -1;
        } else if (RAT[inst.src2] != -1) {
            int tag = RAT[inst.src2];
            if (ROB[tag].ready) {
                free_rs->rhv = ROB[tag].value;
                free_rs->rht = -1;
            } else {
                free_rs->rht = tag;
            }
        } else {
            free_rs->rhv = ARF[inst.src2];
            free_rs->rht = -1;
        }
    } else {
        //not using src2, we can just mark it ready so the unit doesn't wait for it
        free_rs->rht = -1;
    }

    //for store word, src2 is the data to be written. The destination of SW is technically memory.
    if (inst.op == OpCode::SW) {
        ROB[rob_idx].dest_reg = -1; // SW doesn't write to a register
    }

    //uPDATe Rat (Rename destination register)
    //register 0 is hardwired to 0, never rename it.
    if (inst.dest != 0 && inst.op != OpCode::SW && inst.op != OpCode::BEQ && 
        inst.op != OpCode::BNE && inst.op != OpCode::BLT && inst.op != OpCode::BLE) {
        RAT[inst.dest] = rob_idx;
    }
    //finalize Dispatch
    rob_tail = (rob_tail + 1) % ROB.size();
    rob_count++;
    has_fetched_inst = false; // free the fetch latch for next cycle
}
void Processor::broadcastOnCDB() {
    auto processBroadcast = [&](int tag, int val, bool exc, int st_data = 0) {  // functor to prevent repetive and hlper for a single broadcast on CDB
        //update ROB and mark it as finished
        ROB[tag].ready = true;
        ROB[tag].value = val;
        ROB[tag].exception = exc;
        //if its store val has memory and st_data has value to be writtten
        if (st_data != 0 || (ROB[tag].dest_reg == -1 && !ROB[tag].is_branch)) {
            ROB[tag].mem_addr = val; 
            ROB[tag].value = st_data;
        }
        //every unit snoops the bus, if they are waiting for this 'tag',their capture() function will grab the 'val'.
        for (auto& unit : units) {
            unit.capture(tag, val);
        }
        if (lsq != nullptr) {
            lsq->capture(tag, val);
        }
    };
    //check all ALU Execution Units to see if they finished an instruction this cycle
    for (auto& unit : units) {
        if (unit.has_result) {
            processBroadcast(unit.broadcastTag, unit.broadcastVal, unit.has_exception);
            unit.has_result = false; //reset the flag to make sure not same result passed on in next cycle
        }
    }
    //check the Load/Store Queue to see if a memory operation finished
    if (lsq != nullptr && lsq->has_result) {
        processBroadcast(lsq->broadcastTag, lsq->broadcastVal, lsq->has_exception, lsq->store_data);
        lsq->has_result = false;
        lsq->store_data = 0; 
    }
}

void Processor::stageExecuteAndBroadcast() {
    for(auto &unit : units){
        unit.executeCycle();
    }
    if (lsq != nullptr) {
        lsq->executeCycle(Memory, ROB, rob_head, rob_count);
    }
    broadcastOnCDB();
}

void Processor::stageCommit() {
    if (rob_count == 0) {   //if empty nothing to do
        return;
    }
    int head = rob_head;
    //if the oldest instruction is not ready, STALL the commit stage
    if (!ROB[head].ready) {
        return;
    }
    if (ROB[head].exception) {  // handle exception by simply stalling the sys and flushing the incorrect data
        this->exception = true;
        this->pc = ROB[head].pc; //report the PC that caused the exception
        flush();                 //clear all speculative instructions in the pipeline
        return;                  // no changes to be made
    }

    //register update on wrting to reg and reg!=0
    if (ROB[head].dest_reg != -1 && ROB[head].dest_reg != 0) {
        ARF[ROB[head].dest_reg] = ROB[head].value;
        //if the RAT is still pointing to this ROB entry, clear it because the most recent value is now in the ARF.
        if (RAT[ROB[head].dest_reg] == head) {
            RAT[ROB[head].dest_reg] = -1;
        }
    }

    //memory update (Store Word)only writing at commit time since if earlier exception or mispred
    if (ROB[head].mem_addr != -1 && ROB[head].dest_reg == -1 && !ROB[head].is_branch) {
        Memory[ROB[head].mem_addr] = ROB[head].value;
    }

    //branch resolving
    if (ROB[head].is_branch) {
        Instruction inst = inst_memory[ROB[head].pc];
        bool actually_taken = (ROB[head].value == 1); 
        int correct_next_pc = actually_taken ? (inst.pc + inst.imm) : (inst.pc + 1);
        // our decision vs actual decision
        bool pred_taken = ROB[head].pred_taken;
        bool was_correct = (actually_taken == pred_taken);
        //update the 2-bit branch predictor
        bp.update(inst.pc, correct_next_pc, actually_taken, was_correct);
        if (!was_correct) {
            // mispred then ie fetched the wrong instructions, flush and reset pc.
            flush();
            this->pc = correct_next_pc;
            return; //exit immediately because flush() wiped the ROB, including the head we are currently on
        }
    }
    // get inst back from ROB completion
    ROB[head].valid = false;
    ROB[head].mem_addr = -1; //clean up memory address
    ROB[head].is_branch = false;
    rob_head = (rob_head + 1) % ROB.size();
    rob_count--;
}
bool Processor::step() {
    // Important: Stages execute in reverse order in software simulation
    flushed_this_cycle = false;
    stageCommit();
    stageExecuteAndBroadcast();
    stageDecode();
    if (!flushed_this_cycle) {
        stageFetch();
    }
    clock_cycle++;
    for (auto& unit : units) {//added bcuz realised the new mistake that when rs entry freed in same cycle it may be used by decode then there is an issue
        for (auto& entry : unit.rs_entries) {
            entry.free_now = false;
        }
    }
    if (lsq != nullptr) {
        for (auto& entry : lsq->lsq_entries) {
            entry.free_now = false;
        }
    }
    if ((rob_count == 0 && pc >= inst_memory.size() && !has_fetched_inst)||exception) {
        return false; 
    }
    return true;
}

void Processor::dumpArchitecturalState() {
    std::cout << "\n=== ARCHITECTURAL STATE (CYCLE " << clock_cycle << ") ===\n";
    for (int i = 0; i < ARF.size(); i++) {
        std::cout << "x" << i << ": " << std::setw(4) << ARF[i] << " | ";
        if ((i+1) % 8 == 0) std::cout << std::endl;
    }
    if (exception) {
        std::cout << "EXCEPTION raised by instruction " << pc + 1 << std::endl;
    }
    std::cout << "Branch Predictor Stats: " << bp.correct_predictions << "/" << bp.total_branches << " correct.\n";
}