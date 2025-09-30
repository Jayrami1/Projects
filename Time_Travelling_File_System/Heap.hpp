#pragma once
using namespace std;
#ifndef HEAP_HPP
#define HEAP_HPP
#include "HashMap.hpp"
#include <string>
const int MAX = 10e8;
class Heap {
private:
    pair<string, long long>* data;
    int capacity;
    int size;
    HashMap<string, int> index_map;
    void heapUp(int i) {
        while (i > 0 && data[i].second > data[(i - 1) / 2].second) {
            swap(i, (i - 1) / 2);
            i = (i - 1) / 2;
        }
    }
    void heapDown(int i) {
        while (true) {
            int largest = i;
            int left = 2 * i + 1;
            int right = 2 * i + 2;
            if (left < size && data[left].second > data[largest].second) largest = left;
            if (right < size && data[right].second > data[largest].second) largest = right;
            if (largest == i) break;
            swap(i, largest);
            i = largest;
        }
    }
    void swap(int i, int j) {
        pair<string, long long> temp = data[i];
        data[i] = data[j];
        data[j] = temp;
        index_map.HashInsert(data[i].first, i);
        index_map.HashInsert(data[j].first, j);
    }

    void resize() {
        int new_capacity = capacity * 2;
        pair<string, long long>* new_data = new pair<string, long long>[new_capacity];
        for (int i = 0; i < size; ++i) {
            new_data[i] = data[i];
        }
        delete[] data;
        data = new_data;
        capacity = new_capacity;
    }
public:
    Heap() {
        capacity = 1000;
        size = 0;
        data = new pair<string, long long>[capacity];
    }
    ~Heap() {
        delete[] data;
    }
    void insert(const string& filename, long long val) {
        if (index_map.keyPresent(filename)) {
            int idx = index_map.HashGet(filename);
            int prev_val = data[idx].second;
            data[idx].second = val;
            if (val > prev_val) {
                heapUp(idx);
            } else {
                heapDown(idx);
            }
        } else {
            if (size == capacity) resize();
            data[size] = {filename, val};
            index_map.HashInsert(filename, size);
            heapUp(size);
            ++size;
        }
    }
    long long modtime(const string& filename){
        int idx = index_map.HashGet(filename);
        long long val = data[idx].second;
        return val/MAX;
    }
    vector<string> getMaxElements(int k) {
        vector<string> result;
        pair<string, long long>* temp = new pair<string, long long>[size];
        if(k == -1) k = size;
        for (int i = 0; i < size; ++i) temp[i] = data[i];
        int m = size;
        for (int i =0; i <k && m > 0; ++i) {
            result.push_back(temp[0].first);
            temp[0] = temp[m - 1];
            --m;
            int idx = 0;
            while (true) {
                int largest = idx;
                int left = 2 * idx + 1;
                int right = 2 * idx + 2;
                if (left < m && temp[left].second > temp[largest].second) largest = left;
                if (right< m&& temp[right].second > temp[largest].second) largest = right;
                if (largest == idx) break;
                std::swap(temp[idx], temp[largest]);
                idx = largest;
            }
        }
        delete[] temp;
        return result;
    }
    bool isEmpty(){
        return size == 0;
    }
};
#endif