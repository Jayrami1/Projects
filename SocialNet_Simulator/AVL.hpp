#pragma once
#ifndef AVL_HPP
#define AVL_HPP
#include <iostream>
#include <string>
#include <vector>
#include<algorithm>
using namespace std;
struct Post
{
    string content;
    long long timestamp;
    Post(int t,string c="Empty Post"):content(c),timestamp(t){}
};
struct Node
{
    Post post;
    Node *left;
    Node *right;
    int height;
    Node(Post p):post(p),left(nullptr),right(nullptr),height(0){}
};
class AVLTree{
    private:
        Node*root;
        
        int height(Node*node)
        {
            return node ? node->height : -1 ;
        }

        int getBalance(Node*node)
        {
            return height(node->left) - height(node->right);
        }

        Node*leftrotate(Node*node)
        {
            Node*temp = node->right;
            Node*sub_T = temp->left;
            temp->left = node;
            node->right = sub_T;
            node->height = max(height(node->left),height(node->left)) + 1;
            temp->height = max(height(temp->left),height(temp->left)) + 1;
            return temp;
        }
        Node*rightrotate(Node*node)
        {
            Node*temp = node->left;
            Node*sub_T = temp->right;
            temp->right = node;
            node->left = sub_T;
            node->height = max(height(node->left),height(node->left)) + 1;
            temp->height = max(height(temp->left),height(temp->left)) + 1;
            return temp;
        }
        Node*insert(Node*node,Post post){
            if(!node) return new Node(post);
            if (post.timestamp < node->post.timestamp)
            {
                node->left = insert(node->left, post);
            }
            else
            {
                node->right = insert(node->right, post);
            }
            node->height = 1 + max(height(node->left),height(node->right));
            int balance = getBalance(node);

            if(balance>1 && post.timestamp < node->left->post.timestamp)
            {
                return rightrotate(node);
            }
            else if(balance>1 && post.timestamp > node->left->post.timestamp)
            {
                node->left = leftrotate(node->left);
                return rightrotate(node);
            }
            else if(balance <-1 && post.timestamp > node->right->post.timestamp)
            {
                return leftrotate(node);
            }
            else if(balance <-1 && post.timestamp < node->right->post.timestamp)
            {
                node->right = rightrotate(node->right);
                return leftrotate(node);
            }
            return node;
        }

        void revinorder(Node*node,vector<Post>&p)
        {
            if (!node) return;
            revinorder(node->right, p);
            p.push_back(node->post);
            revinorder(node->left, p);
            return;
        }

    public:
        
        AVLTree():root(nullptr){}
        void insert(Post post)
        {
            root = insert(root,post);
        }
        vector<Post>printNposts(int n){
            vector<Post>p;
            revinorder(root,p);
            if(n == -1 || n > p.size())
            {
                return p; 
            }
            else
            {
                return vector<Post>(p.begin(),p.begin()+n);
            }
        }
};
#endif