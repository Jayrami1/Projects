#pragma once
#ifndef LIST_HPP
#define LIST_HPP
#include<iostream>
#include<vector>
#include <type_traits>
template<typename K,typename V>
class List{
    private:
        struct Node
        {
            std::pair <K,V> data;
            Node * next;
            Node(const K&k,const V&v): data(k,v) , next(nullptr) {}
        };
        Node * head;
        int calculateHash(int key, int new_size) {
            return key % new_size;
        }
        
        int calculateHash(const string& key, int new_size) {
            int hash = 0, prime = 31;
            for(char ch : key) {
                hash = (hash * prime + ch) % new_size;
            }
            return hash;
        }
    public:
        List(){
            head = nullptr;
        }
        ~List(){
            while(head){
                Node *temp = head;
                head = head -> next;
                delete temp;
            }
        }
        void insert(const K& key, const V& value){
            Node* curr = head;
            while (curr) {
                if (curr ->data.first == key) {
                    curr-> data.second = value;
                    return ;
                }
                curr = curr->next;
            }
            Node* new_node = new Node(key, value);
            new_node->next = head;
            head = new_node;
        }
        bool isPresent(const K& key){
            Node* curr = head;
            while (curr) {
                if (curr->data.first == key) return true;
                curr = curr->next;
            }
            return false;
        }
        V get(const K& key){
            Node* curr = head;
            while(curr){
                if(curr->data.first == key) return curr->data.second;
                curr = curr->next;
            }
            return V();
        }
        void del(const K& key){
            Node* curr = head;
            Node* prev = nullptr;
            while (curr) {
                if (curr->data.first == key) {
                    if (prev) prev->next = curr->next;
                    else head = curr->next;
                    delete curr;
                    return;
                }
                prev = curr;
                curr = curr->next;
            }
        }
        void reinsertInto(std::vector<List<K, V>>& new_table, int new_size){
            Node* curr = head;
            while (curr) {
                int new_idx = calculateHash(curr->data.first, new_size);
                new_table[new_idx].insert(curr->data.first, curr->data.second);
                curr = curr->next;
            }
        }
};
#endif