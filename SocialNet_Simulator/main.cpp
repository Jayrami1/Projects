#include<iostream>
#include<string>
#include<sstream>
#include"graph.hpp"
using namespace std;

class SocialNet
{
    private:
        Graph Net;
        string toLower(string s) 
        {
            for (char &c : s)
                if (c >= 'A' && c <= 'Z')
                    c = c - 'A' + 'a';
            return s;
        }
    public:
        SocialNet(){}

        void commandline(string input)
        {
            istringstream l(input);
            string cmd;
            l >> cmd;

            if(cmd == "ADD_USER")
            {
                string user;
                l >> user;
                user = toLower(user);
                Net.addUser(user);
            }
            else if(cmd == "ADD_FRIEND")
            {
                string u1 , u2;
                l >> u1 >> u2;
                u1 = toLower(u1);
                u2 = toLower(u2);
                Net.addFrnd(u1,u2);
            }
            else if (cmd == "ADD_POST")
            {
                string user;
                l >> user;
                string post;
                user = toLower(user);
                getline(l>>ws,post);
                Net.addPost(user,post);
            }
            else if(cmd == "LIST_FRIENDS")
            {
                string user;
                l >> user;
                user = toLower(user);
                vector<string> frnds = Net.frndlist(user);
                for(auto &f: frnds)
                {
                    cout << f << endl;
                }
            }
            else if(cmd == "SUGGEST_FRIENDS")
            {
                string user;
                int n;
                l >> user >> n;
                user = toLower(user);
                vector<string> suggest = Net.suggest_frnds(user,n);
                for(auto &sug : suggest)
                {
                    cout << sug << endl;
                }
            }
            else if(cmd == "DEGREES_OF_SEPARATION")
            {
                string t1,t2;
                l >> t1 >> t2;
                string u1,u2;
                l >> u1 >> u2;
                u1 = toLower(u1);
                u2 = toLower(u2);
                cout << Net.degreesOfSeparation(u1,u2) << endl;
            }
            else if(cmd == "OUTPUT_POSTS")
            {
                string user;
                int n;
                l >> user >> n;
                user = toLower(user);
                Net.output_posts(user,n);
            }
            else{cout << "Invalid Command" << endl;}
            return;
        }
};

int main()
{
    SocialNet S;
    string input;
    cout << endl;
    cout << "SocialNet Simulator" << endl << endl;
    cout << "Commands List :" << endl<<endl;
    cout << "ADD_USER        <username>               : To create a user on net " << endl;
    cout << "ADD_FRIEND      <username1> <username2>  : To make two users as friends" << endl;
    cout << "ADD_POST        <username> <Content>     : To post content from user" << endl;
    cout << "LIST_FRIENDS    <username>               : To list all friends from user " << endl;
    cout << "SUGGEST_FRIENDS <username> <N>           : To suggest friends of friends of a user" << endl;
    cout << "DEGREES_OF_SEPARATION     <username1> <username2>   : To find distance between two users" << endl;
    cout << "OUTPUT_POSTS    <username> <N>           : To output newest n posts from user" << endl;
    cout << "EXIT                                     : To exit the CommandLine" << endl << endl;
    while (true){
        getline(cin, input);
        if(input == "EXIT"){
            break;
        }
        if (!input.empty()) {
            S.commandline(input);
        }
    }
    return 0;
}