# Compiler and flags
CXX = g++
CXXFLAGS = -std=c++17 -Wall

# ==========================================
# make compile FILE=<filename.cpp>
# ==========================================
# This target compiles your core simulator files along with the provided main.cpp
compile:
	@echo "Compiling simulator..."
	$(CXX) $(CXXFLAGS) Processor.cpp ExecutionUnit.cpp LoadStoreQueue.cpp BranchPredictor.cpp $(FILE) -o main
	@echo "Build successful, 'main' created."

# ==========================================
# make run FILE=<filename.s>
# ==========================================
# This target compiles the C++ preprocessor and runs it on your assembly file.
run:
	@echo "Building compiler..."
	$(CXX) $(CXXFLAGS) compiler.cpp -o compiler
	@echo "Preprocessing $(FILE)..."
	./compiler $(FILE)
	@echo "Preprocessing complete."

# ==========================================
# make clean
# ==========================================
# This target safely removes all compiled executables to give you a clean directory.
clean:
	@echo "Cleaning up build files..."
	rm -f main compiler
	@echo "Clean complete."