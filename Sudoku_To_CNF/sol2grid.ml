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
    (close_in ic; Printf.printf("Unsatisfiable");exit 0) 
  else
    (*Read model function lists all numbers or ids from sat output using previously defined input parser*)
    let rec read_model acc =
  try read_model (parse_line (input_line ic) acc)
  with End_of_file -> close_in ic; acc 
    in
    let vars = read_model [] in
    (*Positive values indicate presence in sudoku table*)
    let positive_vars = filter (fun x -> x > 0) vars in
    (*Determine grid size from total variable count*)
    let grid_size = int_of_float (Float.round((float_of_int (List.length vars))**(1.0/.3.0))) in
    (*making sudoku grid and then pipelining in make file to output.txt*)
    let rec print_grid r c =
      if r > grid_size then ()  (*If all rows iterated finish*)
        (*if it exceeds col size then col to 1 and enters next row*)
      else if c > grid_size then (print_newline (); print_grid (r + 1) 1)
      else 
        (*Finds sat output r c and v then prints it accordingly. *)
        let rec find_v = function
          | [] -> '?'
          | id::t -> 
            let v = ((id - 1) mod grid_size) +1 in
            let id_c = (((id - 1) / grid_size) mod grid_size)+ 1 in
            let id_r = ((id -1)/(grid_size*grid_size)) +1 in
            if id_r = r && id_c= c then int_to_hex v grid_size else find_v t
        in 
        print_char (find_v positive_vars); (*Char printing*)
        print_grid r (c + 1)(*moving to next column*)
    in
  print_grid 1 1 (*Print function start from 1 1*)