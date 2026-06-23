#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <unordered_map>
#include <sstream>
using namespace std;
string trim(const string& str) {    // trim off any excess whitespace and tabs and enters at start and end
    size_t first = str.find_first_not_of(" \t\r\n");
    if (first == string::npos) return "";
    size_t last = str.find_last_not_of(" \t\r\n");
    return str.substr(first, (last - first + 1));
}
int main(int argc, char* argv[]) {
    if (argc < 2) {
        cerr << "Usage: ./compiler <filename.s>\n"; //as per readme we need to support atleast filename.s passed to main function itself
        return 1;
    }
    string filename = argv[1];
    ifstream input_file(filename);
    if (!input_file.is_open()) {
        cerr << "Error: Could not open file" << filename << endl;
        return 1;
    }
    vector<string> raw_lines;
    string line;
    //read all lines, strip comments, and trim
    while (getline(input_file, line)) {
        size_t hash_pos = line.find('#');
        if (hash_pos != string::npos) {
            line = line.substr(0, hash_pos); // Remove comment
        }
        line = trim(line);
        if (!line.empty()) {
            raw_lines.push_back(line);
        }
    }
    input_file.close(); //maps string to pc
    unordered_map<string, int> mem_labels;  // For .A : 1 2 3 4 type creation 
    unordered_map<string, int> inst_labels; // For naming loops and functions
    vector<string> memory_declarations;
    vector<string> instructions;
    int mem_offset = 0;
    int current_pc = 0;
    //identify labels and compute their addresses/offsets
    for (const string& l : raw_lines) {
        if (l[0] == '.') {
            //memory Declaration
            memory_declarations.push_back(l);
            size_t colon_pos = l.find(':');
            if (colon_pos != string::npos) {
                string label = l.substr(1, colon_pos - 1); //extract label till :
                mem_labels[label] = mem_offset;
                //count how many memory items are there to allocate space, and mem_offsets
                stringstream ss(l.substr(colon_pos + 1));
                int val;
                while (ss >> val){
                    mem_offset++;
                }
            }
        } 
        else if (l.find(':') != string::npos) {
            // for instructions like loop: functions def. etc
            size_t colon_pos = l.find(':');
            string label = trim(l.substr(0, colon_pos));
            inst_labels[label] = current_pc;
            string rest = trim(l.substr(colon_pos + 1)); //check if there is an instruction on the same line after the colon
            if (!rest.empty()) {
                instructions.push_back(rest);
                current_pc++;
            }
        } 
        else {
            // normal instr.
            instructions.push_back(l);
            current_pc++;
        }
    }

    //resolve labels and rewrite the file
    ofstream output_file(filename);
    if (!output_file.is_open()) {
        cerr << "Error: Could not write to file " << filename << endl;
        return 1;
    }
    //write memory declarations back at the top so the processor can load them
    for (const string& mem_decl : memory_declarations) {
        output_file << mem_decl << "\n";
    }

    //process and write instructions
    for (int i = 0; i < (int)instructions.size(); i++) {
        string inst = instructions[i];
        //resolve mem labels
        for (const auto& pair : mem_labels) {
            string target = pair.first + "(";
            size_t pos = inst.find(target);
            if (pos != string::npos) {
                inst.replace(pos, pair.first.length(), to_string(pair.second));
            }
        }
        //resolve branch labels
        for (const auto& pair : inst_labels) {
            size_t pos = inst.rfind(pair.first);
            if (pos != string::npos) {
                bool is_standalone = true;
                if (pos > 0 && isalnum(inst[pos - 1])) is_standalone = false;   // to make sure like selecting L1 in case of L10 doesnt happen
                if (pos + pair.first.length() < inst.length() && isalnum(inst[pos + pair.first.length()])) is_standalone = false;
                if (is_standalone) {
                    int offset = pair.second - i; //relative distance or local pc
                    inst.replace(pos, pair.first.length(), to_string(offset));
                }
            }
        }
        output_file << inst << "\n";
    }
    output_file.close();
    cout << "Compilation/Preprocessing successful for " << filename << endl;
    return 0;
}