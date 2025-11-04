echo "Compiling Social Net Simulator..."
g++ -std=c++17 -Wall -Wno-sign-compare -Wno-conversion -O2 *.cpp -o main
if [ $? -ne 0 ]; then
    echo "Compilation failed. Please check for errors."
    exit 1
fi
echo "Compilation successful."
echo
read -p "Run with input.txt? (y/n) " choice
if [[ "$choice" == [Yy] ]]; then
    echo "Running with input.txt..."
    ./main < input.txt
else
    echo "Running interactively."
    ./main
fi