#pragma once
#ifndef FILE_HPP
#define FILE_HPP
#include "TreeNode.hpp"
#include "HashMap.hpp"
#include "Heap.hpp"
#include<string>
#include<vector>
using namespace std;
class File{
    public:
        string file_name;
        TreeNode* root;
        TreeNode* active_version;
        HashMap<int,TreeNode*> version_map;
        int total_versions;
        File(const string& filename):file_name(filename), total_versions(1)
        {
            root = new TreeNode(0, "Initial snapshot");
            active_version = root;
            version_map.HashInsert(0, root);
        }
        string read(){
            if(active_version->content!="") return active_version->content;
            cout << "Empty Content"; return "";
        }
        void insert(const string& content){
            if(active_version->snapshot_timestamp!=0){
                TreeNode* new_version =new TreeNode(total_versions++);
                new_version->content =  active_version->content + content;
                new_version->parent = active_version;
                active_version->children.push_back(new_version);
                active_version = new_version;
                version_map.HashInsert(new_version->version_id, new_version);
            }
            else{
                active_version->content+=content;   
            }
        }
        void update(const string& content){
            if(active_version->snapshot_timestamp!=0){
                TreeNode* new_version = new TreeNode(total_versions++);
                new_version->content = content;
                new_version->parent = active_version;
                active_version->children.push_back(new_version);
                active_version = new_version;
                version_map.HashInsert(new_version->version_id, new_version);
            }
            else{
                active_version->content=content;   
            }
        }
        void snapshot(const string& message = "Initial Snapshot"){
            if(active_version->snapshot_timestamp){
                char* timeString = ctime(&active_version->snapshot_timestamp);
                cout << "Version Already Snapshotted at: " << timeString ;
            }
            else{
            active_version->message = message;
            active_version->snapshot_timestamp = time(nullptr);
            }
        }
        void rollback(int version_id = -1){
            if(version_id == -1 && active_version->parent){
                active_version = active_version->parent;
            }
            else if(version_map.keyPresent(version_id)){
                active_version = version_map.HashGet(version_id);
            }
        }
        void history(){
            TreeNode* curr = active_version;
            while(curr != nullptr){
                if (curr->snapshot_timestamp != 0) {
                    char* timeString = ctime(&curr->snapshot_timestamp);
                    cout << "Version: " << curr->version_id<< "| Message: " << curr->message<< "| Snapshot At: " << timeString;
                }
                curr = curr->parent;
            }
            return ;
        }  
};
#endif