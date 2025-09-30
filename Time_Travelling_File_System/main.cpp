#include "File.hpp"
#include "Heap.hpp"
#include "HashMap.hpp"
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <ctime>
using namespace std;
class FileSystem{
    private:
        HashMap<string,File*>file_map;
        Heap recent_Files;
        Heap biggest_Files;
        long long regulatory = 0;
        void update(string &filename,int total_version){
            time_t curr_time = time(nullptr);
            long long curr = static_cast<long long>(curr_time);
            time_t prev_time = 0;
            if(curr_time!=prev_time){
                prev_time = curr_time;
                regulatory = 0;
            }
            long long comp_time = curr*MAX + regulatory;
            recent_Files.insert(filename,comp_time);
            regulatory ++;
            biggest_Files.insert(filename,total_version);
        }
        bool check(string filename){
            if(!file_map.keyPresent(filename)){
                cout << "Filename not present in system. Do you want to add File?(Use CREATE)" << endl;
                return false;
            }
            return true;
        }
        int numcheck(string numstring){
            stringstream ss(numstring);
            int num;
            if (ss >> num && ss.eof()){
                if(num >= 0) return num;
                else{cout << "Negative value not permitted" << endl; ;return -1;}
            }
            else{
                cout << "Please give integer value" << endl;
                return -1;
            }
        }
    public:
        void command(string &input){
            istringstream l(input);
            string cmd;
            l >> cmd ;
            if(cmd == "CREATE"){
                string filename;
                if(l >> filename){  
                    if(file_map.keyPresent(filename)) cout << "File Already Exists" <<endl;
                    else{             
                        File * f = new File(filename);
                        file_map.HashInsert(filename,f);
                        file_map.HashGet(filename)->snapshot();
                        update(filename,file_map.HashGet(filename)->total_versions);
                    }
                }
                else{
                    cout << "Enter Filename and Retry!" << endl;
                }
            }
            else if(cmd == "READ"){
                string filename;
                if(l >> filename){
                    if(check(filename)){
                        cout << file_map.HashGet(filename)->read() << endl;
                    }
                }
                else{cout << "Enter Filename and Retry!" << endl;}
                cout << endl;
            }
            else if(cmd == "INSERT"){
                string filename;
                if(l >> filename){
                    if(check(filename)){
                        string content;
                        getline(l>>std::ws,content);
                        file_map.HashGet(filename)->insert(content);
                        update(filename,file_map.HashGet(filename)->total_versions);
                    }
                }
                else{cout << "Enter Filename and Retry!" << endl;}
            }
            else if(cmd == "UPDATE"){
                string filename;
                if(l >> filename){
                    if(check(filename)){
                        string content;
                        getline(l >> std::ws,content);
                        file_map.HashGet(filename)->update(content);
                        update(filename,file_map.HashGet(filename)->total_versions);
                    }
                }
                else{cout << "Enter Filename and Retry!" << endl;}
            }
            else if(cmd == "SNAPSHOT"){
                string filename;
                if(l >> filename){
                    if(check(filename)){
                        string message;
                        getline(l>>std::ws,message);
                        file_map.HashGet(filename)->snapshot(message);
                        update(filename,file_map.HashGet(filename)->total_versions);
                    }
                }
                else{cout << "Enter Filename and Retry!" << endl;}
            }
            else if (cmd == "ROLLBACK"){
                string filename;
                if(l >> filename){
                    string version_str;
                    if (l >> version_str){
                    if(check(filename)){
                    if(numcheck(version_str)>=0){
                        int version_id = numcheck(version_str);
                        File* file = file_map.HashGet(filename);
                        if (file->version_map.keyPresent(version_id)) {
                            file->rollback(version_id);
                        }else {
                            cout << "Version " << version_id << " does not exist!" << endl;
                        }
                    }
                        }
                    }
                else{
                        cout << "Enter Filename and Retry!" << endl;
                    }
                }
            }
            else if(cmd == "HISTORY"){
                string filename;
                if(l >> filename){
                    if(check(filename)){
                        cout << filename << ": " <<endl;
                        file_map.HashGet(filename)->history();
                    }
                }
                else{cout << "Enter Filename and Retry!" << endl;}
                cout << endl;
            }
            else if(cmd == "RECENT_FILES"){
                if(recent_Files.isEmpty()){cout << "No FIles Present";}
                else{
                vector<string>recent;
                string numstring ;
                if(l >> numstring){
                    if(numcheck(numstring)>=0){
                        
                        int num = numcheck(numstring);
                        recent = recent_Files.getMaxElements(num);
                    }
                }
                else{
                    cout << "No index provided. Showing all files in recent order" << endl;
                    recent = recent_Files.getMaxElements(-1);
                } 
                for(string &s : recent){
                    time_t now = time(nullptr);
                    long long n = static_cast<long long>(now);
                    long long diff_seconds = n - recent_Files.modtime(s);
                    cout << s << " | Last Modified : ";
                    if(diff_seconds<60.0){
                        cout << diff_seconds << " seconds ago" << endl;
                    }
                    else if(diff_seconds<3600.0){
                        cout << diff_seconds/60 << " minutes ago" << endl;
                    }
                    else{
                        cout << diff_seconds/3600 << " hours ago" << endl;
                    }
                }
            }
                cout << endl;
            }
            else if(cmd == "BIGGEST_TREES"){
                if(biggest_Files.isEmpty()) cout << "No Files Present";
                else{
                    vector<string>biggest;
                    string numstring;
                    if(l >> numstring){
                        if(numcheck(numstring)>=0){
                            int num = numcheck(numstring);
                            biggest = biggest_Files.getMaxElements(num);
                        }
                    }
                    else{
                        cout << "No index provided. Showing all files in order of size" << endl;
                        biggest = biggest_Files.getMaxElements(-1);
                    }
                    for(string &s : biggest){
                        cout << s <<" | Versions: " << file_map.HashGet(s)->total_versions << endl;
                    }
                }
                cout << endl;
            }
            else{
                cout << "Invalid Command" << endl <<endl;
            }
        }
};
int main(){
    FileSystem A;
    string input;
    cout << endl;
    cout << "Time_Travelling_File_System" << endl << endl;
    cout << "Commands List :" << endl<<endl;
    cout << "CREATE        <Filename>               : To create a file " << endl;
    cout << "INSERT        <Filename> <Content>     : To append content to file" << endl;
    cout << "UPDATE        <Filename> <Content>     : To update content" << endl;
    cout << "READ          <Filename>               : To Content of active file" << endl;
    cout << "SNAPSHOT      <Filename> <Message>     : To Snapshot the active version" << endl;
    cout << "ROLLBACK      <Filename> <Versionid>   : To access specific file version" << endl;
    cout << "HISTORY       <Filename>               : To see File's history" << endl;
    cout << "BIGGEST_TREES <index>                  : To see top index biggest files" << endl;
    cout << "RECENT_FILES  <index>                  : To see top index recent files" << endl;
    cout << "EXIT                                   : To exit the FileSystem" << endl << endl;
    while (true){
        std::getline(std::cin, input);
        if(input == "EXIT"){
            break;
        }
        if (!input.empty()) {
            A.command(input);
        }
    }
}