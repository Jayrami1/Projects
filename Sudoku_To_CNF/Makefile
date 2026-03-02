compile:
	ocamlc -o sudoku2cnf sudoku2cnf.ml
	ocamlc -o sol2grid sol2grid.ml
	ocamlc -o check_sudoku check_sudoku.ml
	ocamlc -o multisol multisol.ml
run:
	./sudoku2cnf input.txt > problem.cnf
	z3 -dimacs problem.cnf > sat_output.txt
	./sol2grid sat_output.txt > output.txt
	@if grep -q -e "s UNSATISFIABLE" -e "unsat" -e "UNSAT" sat_output.txt; then \
		echo "UNSATISFIABLE"; \
	else \
			./check_sudoku output.txt input.txt ; \
			./multisol sat_output.txt problem.cnf ; \
		z3 -dimacs multiple_check.cnf > sat_output1.txt ; \
		if grep -q "s UNSATISFIABLE" sat_output1.txt; then \
			echo "Unique Solution"; \
		else \
			echo "Multiple Solutions Found."; \
		fi ; \
	fi

clean:
	rm -f *.cmo *.cmi sudoku2cnf multisol check_sudoku sol2grid problem.cnf sat_output.txt output.txt multiple_check.cnf sat_output1.txt