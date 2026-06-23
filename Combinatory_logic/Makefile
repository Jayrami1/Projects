# The OCaml compiler
OCAMLC = ocamlc
EXEC = evaluate_cl

all: $(EXEC)
$(EXEC): main.cmo test.cmo
	$(OCAMLC) -o $(EXEC) main.cmo test.cmo

main.cmo: main.ml
	$(OCAMLC) -c main.ml
test.cmo: test.ml main.cmo
	$(OCAMLC) -c test.ml
clean:
	rm -f *.cmo *.cmi $(EXEC)

.PHONY: all clean