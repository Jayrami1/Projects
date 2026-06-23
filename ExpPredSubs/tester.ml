open Assignment1

module PRED = struct
  type t = string * int
  let name (n, _) = n
  let arity (_, a) = a
end

module PE = Predexp(PRED)
(*exp format*)
let rec raw_string_of_exp e = match e with
  | E.V v -> Printf.sprintf "V \"%s\"" v
  | E.Node ((n, a), children) ->
      if Array.length children = 0 then 
        Printf.sprintf "Node ((\"%s\", %d), [||])" n a
      else
        let children_strs = Array.to_list (Array.map raw_string_of_exp children) in
        Printf.sprintf "Node ((\"%s\", %d), [| %s |])" n a (String.concat "; " children_strs)

(*ast node format*)
let rec raw_string_of_pred p = match p with
  | PE.T -> "T"
  | PE.F -> "F"
  | PE.Not p1 -> Printf.sprintf "Not (%s)" (raw_string_of_pred p1)
  | PE.And(p1, p2) -> Printf.sprintf "And (%s, %s)" (raw_string_of_pred p1) (raw_string_of_pred p2)
  | PE.Or(p1, p2) -> Printf.sprintf "Or (%s, %s)" (raw_string_of_pred p1) (raw_string_of_pred p2)
  | PE.Pred((n, a), args) ->
      if Array.length args = 0 then 
        Printf.sprintf "Pred ((\"%s\", %d), [||])" n a
      else
        let args_strs = Array.to_list (Array.map raw_string_of_exp args) in
        Printf.sprintf "Pred ((\"%s\", %d), [| %s |])" n a (String.concat "; " args_strs)
(*helper to allow subst typing*)
let make_subst lst =
  let h = Hashtbl.create (List.length lst) in
  List.iter (fun (k, v) -> Hashtbl.add h k v) lst;
  h

let () =
  Printf.printf "--- PART 1: check_sig ---\n";
  Printf.printf "1: %b\n" (check_sig []);
  Printf.printf "2: %b\n" (check_sig [("f", 2); ("g", 1); ("a", 0)]);
  Printf.printf "3: %b\n" (check_sig [("f", 2); ("g", -3)]);
  Printf.printf "4: %b\n" (check_sig [("f", 2); ("b", 1); ("f", 1)]);
  Printf.printf "5: %b\n" (check_sig [("f", 0); ("g", 0)]);
  Printf.printf "6: %b\n" (check_sig [("f", 1000)]);

  Printf.printf "\n--- PART 2A: wfexp ---\n";
  let e2a_1 = E.Node(("f",2), [| E.Node(("g",1), [| E.V "x" |]); E.Node(("a",0), [||]) |]) in
  Printf.printf "1: %b\n" (E.wfexp e2a_1);
  let e2a_2 = E.Node(("f",2), [| E.V "x" |]) in
  Printf.printf "2: %b\n" (E.wfexp e2a_2);
  let e2a_3 = E.Node(("f",2), [| E.V "x"; E.V "y"; E.V "z" |]) in
  Printf.printf "3: %b\n" (E.wfexp e2a_3);
  let e2a_4 = E.Node(("h",2), [| E.V "x" |]) in
  Printf.printf "4: %b\n" (E.wfexp e2a_4);
  let e2a_5 = E.Node(("f",2), [| E.Node(("a",0), [| E.V "x" |]); E.V "y" |]) in
  Printf.printf "5: %b\n" (E.wfexp e2a_5);

  Printf.printf "\n--- PART 2B: ht, size, vars ---\n";
  Printf.printf "1. ht: %d\n" (E.ht e2a_1);
  Printf.printf "2. size: %d\n" (E.size e2a_1);
  let e2b_3 = E.Node(("f",2), [| E.Node(("g",1), [| E.V "y" |]); E.V "x" |]) in
  Printf.printf "3. vars: [%s]\n" (String.concat "; " (E.vars e2b_3));

  Printf.printf "\n--- PART 3: subst, compose, edit, inplace_subst ---\n";
  let x = E.V "x" and y = E.V "y" and z = E.V "z" in
  let a = E.Node(("a",0), [||]) and b = E.Node(("b",0), [||]) and c = E.Node(("c",0), [||]) in

  let s1 = make_subst [("x", E.Node(("h",2), [|b; y|])); ("y", E.Node(("g",1), [|a|]))] in
  let e1 = E.Node(("fn",3), [| E.Node(("g",1), [|x|]); E.Node(("h",2), [|x; y|]); z |]) in
  Printf.printf "1. Substitution: %s\n" (raw_string_of_exp (E.subst s1 e1));

  let s1_comp = make_subst [("x", E.Node(("g",1), [|y|]))] in
  let s2_comp = make_subst [("x", b); ("y", E.Node(("h",2), [|a; b|])); ("z", a)] in
  let e2 = E.Node(("h",2), [|x; z|]) in
  let comp_s = E.composition s2_comp s1_comp in
  Printf.printf "2. Composition: %s\n" (raw_string_of_exp (E.subst comp_s e2));

  let e3 = E.Node(("fn",3), [| E.Node(("g",1), [|x|]); c; E.Node(("h",2), [|b; a|]) |]) in
  let e3_edited = E.edit e3 [2; 1] (E.Node(("g",1), [|c|])) in
  Printf.printf "3. Edit: %s\n" (raw_string_of_exp e3_edited);

  let e4 = E.Node(("f",2), [| x; E.Node(("g",1), [|x|]) |]) in
  let s4 = make_subst [("x", E.Node(("g",1), [|b|]))] in
  E.in_situ_subst s4 e4;
  Printf.printf "4. In-place substitution: %s\n" (raw_string_of_exp e4);

  Printf.printf "\n--- PART 5: wff, psubst, wp ---\n";
  Printf.printf "1. wff T: %b\n" (PE.wff PE.T);
  Printf.printf "1. wff F: %b\n" (PE.wff PE.F);
  Printf.printf "1. wff Pred R(a): %b\n" (PE.wff (PE.Pred(("R",0), [|a|])));

  let p_p = PE.Or(PE.Pred(("Q",1), [|x|]), PE.Pred(("P",2), [|x; y|])) in
  let s_p = make_subst [("x", E.Node(("h",2), [|b; y|])); ("y", E.Node(("g",1), [|a|]))] in
  Printf.printf "2. Predicate substitution: %s\n" (raw_string_of_pred (PE.psubst s_p p_p));

  let p_wp = PE.And(PE.Not(PE.Pred(("P",2), [|x; y|])), PE.Pred(("Q",1), [|x|])) in
  Printf.printf "3. Weakest precondition: %s\n" (raw_string_of_pred (PE.wp "x" (E.Node(("g",1), [|b|])) p_wp));