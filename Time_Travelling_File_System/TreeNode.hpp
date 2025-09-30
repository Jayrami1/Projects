#pragma once
#ifndef TREENODE_HPP
#define TREENODE_HPP
#include<string>
#include<vector>
#include<ctime>
using namespace std;
class TreeNode{
    public:
        int version_id;
        string content;
        string message;
        time_t created_timestamp;
        time_t snapshot_timestamp;
        TreeNode* parent;
        vector<TreeNode*> children;
        TreeNode(int id, const string & message=""):
        version_id(id), content(""), message(message),
        created_timestamp(time(nullptr)), snapshot_timestamp(0),
        parent(nullptr){}
};
#endif