# The OCaml compiler
OCAMLC = ocamlc

# The name of your final executable
EXEC = interpreter

# The default target
all: $(EXEC)

# Link the compiled object files into the executable
$(EXEC): assignment3.cmo tests.cmo main.cmo
	$(OCAMLC) -o $(EXEC) assignment3.cmo tests.cmo main.cmo

# Compile the core logic first
assignment3.cmo: assignment3.ml
	$(OCAMLC) -c assignment3.ml

# Compile the tests file (depends on assignment3)
tests.cmo: tests.ml assignment3.cmo
	$(OCAMLC) -c tests.ml

# Compile the main execution file (depends on assignment3 and tests)
main.cmo: main.ml assignment3.cmo tests.cmo
	$(OCAMLC) -c main.ml

# Automatically build and run
run: $(EXEC)
	./$(EXEC)

# Clean up generated files
clean:
	rm -f *.cmo *.cmi $(EXEC)