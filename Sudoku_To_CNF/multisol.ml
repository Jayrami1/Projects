(*Defined functions in class map and filter*)
let rec map f s = match s with 
  | [] -> [] 
  | x :: xs -> (f x) :: (map f xs)

let rec filter p s = match s with
  | [] -> []
  | x :: xs -> if (p x) then x :: (filter p xs) else (filter p xs)

  (*Parses each line in input_line from file and based on neg_val sets flag neg_val generates correct decimal values of numbers
  and make sures to break numbers in space new line and v*)
  let parse_line line acc =
  let len = String.length line in
  let rec parse i current_val is_neg acc =
    if i = len then 
      (*If number is neg or not*)
      if current_val = 0 then acc else (if is_neg then -current_val else current_val)::acc
  else match line.[i] with
      | ' ' | '\n' | 'v' ->  (*Space, new line , v characters new line*)
        if current_val = 0 then parse (i + 1) 0 false acc
        else parse (i + 1) 0 false ((if is_neg then -current_val else current_val)::acc)
    | '-' -> parse (i + 1) 0 true acc
    | '0'..'9' as c -> parse (i + 1) (current_val*10 +(int_of_char c - 48)) is_neg acc
    | _ -> parse (i + 1) 0 false acc
  in parse 0 0 false acc

  let rec neg_list l = match l with
  [] -> []
  | x::xs -> -x :: (neg_list xs)  
(*mapping n <= 3 -> 1-9 or n = 4 -> 0-F *)
let int_to_hex v grid_size = 
  if grid_size <= 9 then char_of_int (v + 48) (*1->1*)
  else if v <= 10 then char_of_int (v + 47) (* 1->0*)
  else char_of_int (v + 54) (* 11->'A' *)

let () =
  let ic = open_in "sat_output.txt" in
  let first_line = try input_line ic with End_of_file -> "" in
  (*iF not sat or satisfiable then unsatisfiable printed*)
  if first_line <> "SAT" && first_line <> "sat" && first_line <> "s SATISFIABLE" then 
    (close_in ic;exit 0) 
  else
    (*Read model function lists all numbers or ids from sat output using previously defined input parser*)
    let rec read_model acc =
  try read_model (parse_line (input_line ic) acc)
  with End_of_file -> close_in ic; acc 
    in
    let vars = read_model [] in
    let positive_vars = filter (fun x -> x > 0) vars in
    let negative_vars = neg_list positive_vars in
    let ic_cnf = open_in "problem.cnf" in
  let oc = open_out "multiple_check.cnf" in
  
  let rec copy_cnf vars_count clauses_count =
    try
      let line = input_line ic_cnf in
      if String.length line > 0 && line.[0] = 'p' then
        Printf.fprintf oc "p cnf %d %d\n" vars_count (clauses_count + 1)
      else if String.length line > 0 && line.[0] <> 'c' then
        Printf.fprintf oc "%s\n" line;
      copy_cnf vars_count clauses_count
    with End_of_file -> ()
  in
  let n_vars = List.length vars in 
  copy_cnf n_vars 0; (* This is a simplified copy logic *)
  List.iter (fun x -> Printf.fprintf oc "%d " x) negative_vars;
  Printf.fprintf oc "0\n";
  close_in ic_cnf;
  close_out oc;