#pragma once
#ifndef HASHMAP_HPP
#define HASHMAP_HPP
#include "TreeNode.hpp"
#include "List.hpp"
#include<iostream>
#include<vector>
#include<type_traits>
using namespace std;
template<typename K,typename V>
class HashMap{
    private:
        int bucket_count;
        int entry_count;
        int hash(int key) {
            return key % bucket_count;
        }
        
        int hash(const string& key) {
            int hash_val = 0, prime = 31;
            for(char ch : key) {
                hash_val = (hash_val * prime + ch) % bucket_count;
            }
            return hash_val;
        }
        vector<List<K, V>> table;
        void resize(){
            int new_bucket_count = bucket_count*2;
            vector<List<K, V>> new_table(new_bucket_count);
            for (int i = 0; i<bucket_count;++i) {
                table[i].reinsertInto(new_table, new_bucket_count);
            }
            table = new_table;
            bucket_count = new_bucket_count;
        }
    public:
        HashMap() : bucket_count(101), entry_count(0),table(bucket_count){}
        void HashInsert(const K& key, const V&node){
            int idx = hash(key);
            if (!table[idx].isPresent(key)) entry_count++;
            table[idx].insert(key, node);
            if ((float)entry_count / bucket_count > 0.75) {
                resize();
            }
        }
        V HashGet(const K& key){
            int idx = hash(key);
            return table[idx].get(key);
        }
        bool keyPresent(const K& key){
            int idx = hash(key);
            return table[idx].isPresent(key);
        }
        void remove(const K& key) {
            int idx = hash(key);
            if (table[idx].isPresent(key)) {
                table[idx].del(key);
                entry_count--;
            }
        }
        bool isEmpty(){
            return entry_count==0;
        }
};
#endif