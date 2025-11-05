#pragma once
#ifndef GRAPH_HPP
#define GRAPH_HPP
#include<iostream>
#include <unordered_map>
#include <unordered_set>
#include <string>
#include<vector>
#include <queue>
#include <algorithm>
#include "user.hpp"
#include <ctime>
using namespace std;
class Graph
{
    private:
        unordered_map<string,User*>userlist;
        unordered_map<string,unordered_set<string>>frnd;
        bool userExists(string name)
        {
            for(auto &i:userlist)
            {
                if(i.first == name)
                {
                    return true;
                }
            }
            return false;
        }
    public:
        ~Graph()
        {
            for(auto &i :userlist) delete i.second;
        }

        void addUser(string name)
        {
            if(userExists(name)){cout << "User Already Exists." << endl; return;}
            userlist[name] = new User(name);
            frnd[name] = {};
            cout << "User Added"<<endl;
            return;
        }

        void addFrnd(string u1 , string u2)
        {
            if(userExists(u1) && userExists(u2))
            {
                frnd[u1].insert(u2);
                frnd[u2].insert(u1);
                cout << u1 << " and " << u2 << " are now friends."<<endl;
            }
            else if(u1 == u2)
            {
                cout << "Same usernames given." << endl;
            }
            else
            {
                cout << "User given doesn't exist." << endl;
            }
            return;
        }

        vector<string>frndlist(string name)
        {
            vector<string>list;
            for(auto &i:frnd)
            {
                if(i.first == name)
                {
                    for(auto &j :i.second)
                    {
                        list.push_back(j);
                    }
                    break;
                }
            }
            sort(list.begin(),list.end());
            return list; 
        }

        vector<string>suggest_frnds(string name,int n)
        {
            unordered_map<string,int>mutuals;
            vector<string>ppl;
            if(!userExists(name))
            {
                cout << "User doesn't exist." << endl;
                return ppl;
            }
            unordered_set<string> dfrnd;
            for(auto& i :frnd)
            {
                if (i.first == name)
                {
                    for (auto& f : i.second)
                    {
                        dfrnd.insert(f);
                    }
                }
            }
            for (auto& i :frnd) 
            {
                string friendName = i.first;
                if (friendName == name) continue;
                bool isDirect = false;
                for (auto& f : dfrnd) 
                {
                    if (f == friendName) 
                    {
                        isDirect = true;
                        break;
                    }
                }
                if (isDirect) continue;
                int count = 0;
                for (auto& f : dfrnd) 
                {
                    for (auto& f2 : frnd.at(f)) 
                    {
                        if (f2 == friendName) 
                        {
                            count++;
                            break;
                        }
                    }
                }
                if (count > 0) {
                    mutuals[friendName] = count;
                }
            }
            for(auto &i :mutuals)
            {
                ppl.push_back(i.first);
            }
            for (int i = 0; i < ppl.size(); ++i) {
                for (int j = i + 1; j < ppl.size(); ++j) {
                    string a = ppl[i];
                    string b = ppl[j];
                    if (mutuals[a] < mutuals[b] || (mutuals[a] == mutuals[b] && a > b)) {
                        swap(ppl[i], ppl[j]);
                    }
                }
            }
            vector<string>ans;
            for(int i=0;i<n && i<ppl.size();i++)
            {
                ans.push_back(ppl[i]);
            }
            if(ans.empty()){cout << "No Suggestions";}
            return ans;
        }
        int degreesOfSeparation(string u1, string u2)
        {
            if(!userExists(u1)|| !userExists(u2))
            {
                return -1;
            }
            unordered_set<string> visited;
            queue<pair<string, int>> q;
            q.push({u1, 0});
            visited.insert(u1);
            while (!q.empty())
            {
                pair<string, int> front = q.front(); q.pop();
                string curr = front.first;
                int dist = front.second;
                if (curr == u2) return dist;
                for (auto &i : frnd.at(curr))
                {
                    if (visited.insert(i).second)
                    {
                        q.push({i, dist + 1});
                    }
                }
            }
            return -1;
        }
        void addPost(string name,string content)
        {
            time_t curr_time = time(nullptr);
            long long timestamp = static_cast<long long>(curr_time);
            if(!userExists(name)){cout << "Invalid User. Please add user." << endl;return;}
            userlist[name]->addPost(timestamp,content);
            return;
        }

        void output_posts(string name,int n)
        {
            vector<Post>r;
            if(!userExists(name)){cout << "User doesn't exixt. " << endl;return;}
            r = userlist[name]->getPosts(n);
            time_t now = time(nullptr);
            long long ni = static_cast<long long>(now);
            for(int i=0;i<r.size();i++)
            {
                long long diff_seconds = ni - r[i].timestamp;
                cout <<"Uploaded ";
                if(diff_seconds<60.0){
                    cout << diff_seconds << " seconds ago : ";
                }
                else if(diff_seconds<3600.0){
                    cout << diff_seconds/60 << " minutes ago : ";
                }
                else{
                    cout << diff_seconds/3600 << " hours ago : " ;
                }
                cout << r[i].content << endl;
            }
            return;
        }

};
#endif