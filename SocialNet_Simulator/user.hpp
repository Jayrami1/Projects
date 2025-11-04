#pragma once
#ifndef USER_HPP
#define USER_HPP
#include<iostream>
#include <string>
#include <vector>
#include "AVL.hpp"
using namespace std;

class User
{
    private:
        string username;
        AVLTree posts;
    public:
        User(const string& name) : username(name) {}
        string getUsername()
        {
            return username;
        }
        void addPost(long long timestamp,string& content)
        {
            posts.insert(Post(timestamp,content));
            return;
        }
        vector<Post> getPosts(int N)
        {
            return posts.printNposts(N);
        }
};
#endif