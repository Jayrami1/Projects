(*BASIC FUNCTIONS FOR IMPLEMENTING LATER FUNCTIONS*)
(*Defined map, fold_right and flatten and filter according to definitions in class*)
let rec map f s = match s with
| [] -> []
| x::xs -> (f x)::(map f xs)

let rec fold_right f s e = match s with
  | [] -> e 
  | x::xs -> f x (fold_right f xs e)

let flatten lists = 
  fold_right (fun curr acc-> curr@acc) lists []

let rec filter p s = match s with
| [] -> []
| x :: xs -> if (p x) then x :: (filter p xs) else (filter p xs)

(*get_id maps (x,y,val) to an integer for DIMACS cnf fornmat*) 
let get_id n r c v = 
  let grid_size = n*n in
  (r-1)*grid_size*grid_size + (c-1)*grid_size + v

(*atleast one is simply all literals OR*)
let atleast_one id = [id]

(*atmost_one creates negative pair to OR implying only one of them satisfies condition*)
let atmost_one id =
  let rec neg_pairs = function
    | [] -> []
    | h::t -> (map (fun x -> [-h;-x]) t)@(neg_pairs t)
  in neg_pairs id

(*atleast and atmost simulatneously*)
let exactly_one id = (atleast_one id)@ (atmost_one id)

(*f[0,1,2,3,....n-1] initialization*)
let initialize_list len f =
  let rec aux i =
    if i >= len then []
    else (f i) :: aux (i + 1)
  in aux 0

(*Calculating all constraints*)
let constraints n = 
  let grid_size = n*n in
  let range = initialize_list grid_size (fun i->i+1) in

  (*cell constraints: Using map and flatten *)
  let cell_clauses = 
    (* this is the exactly_one clause for this block *)
    flatten (map (fun r -> map (fun c -> exactly_one (map (fun v -> get_id n r c v) range))range )range) in

  (* Row and Column Constraints *)
  let row_clauses = 
    (* this is the exactly_one clause for this block *)
    flatten (map (fun v -> map (fun r -> exactly_one (map (fun c -> get_id n r c v) range))range )range) in

  let col_clauses = 
    (* this is the exactly_one clause for this block *)
    flatten (map (fun v -> map (fun c -> exactly_one (map (fun r -> get_id n r c v) range))range )range) in

  (*Block constraints*)
  let range2 = initialize_list n (fun i -> i) in

  (*(br,bc) indicate block coordinates iterated across 3 values and 
  (r,c) indicate values of row and col in range 3 and final map to iterate values 0-8*)
  let block_clauses =flatten (map (fun v ->
  flatten (map (fun br ->
    map (fun bc->
      let id1 = flatten (map (fun r ->
        map (fun c -> 
          get_id n (br*n+r+1) (bc*n+c+1) v
        ) range2
      ) range2) in
      (* this is the exactly_one clause for this block *)
      exactly_one(id1) 
    ) range2
  ) range2)
) range) in

flatten (cell_clauses @ row_clauses @ col_clauses @ block_clauses)

(*HEX to INT*)
let hex_to_int c n =
  if n <= 3 then (* 9x9 Logic *)
    match c with
    | '1'..'9' -> int_of_char c - int_of_char '0'
    | _ -> -1
  else (* 16x16 Logic: 0-9, A-F *)
    match c with
    | '0'..'9' -> int_of_char c - int_of_char '0' + 1
    | 'A'..'F' -> int_of_char c - int_of_char 'A' + 11
    | _ -> -1

  (*File Input parser using read_lines*)
let () =
  let file = open_in "input.txt" in
  let rec read_lines acc =
    try
      let line = input_line file in
      read_lines (acc ^ line)
    with End_of_file -> acc in
  let sudoku_in = read_lines "" in (*using readline to accumulate in "" all the strings*)
  close_in file;
  let len = String.length sudoku_in in
  let grid_size = int_of_float (sqrt (float_of_int len)) in
  let n = int_of_float (sqrt (float_of_int grid_size)) in
  let index = initialize_list len (fun i -> i) in
  let input_clauses = map (fun i -> [get_id n (i/grid_size + 1) (i mod grid_size + 1) (hex_to_int sudoku_in.[i] n)]
  ) (filter (fun i -> hex_to_int sudoku_in.[i] n > 0) index) in   (*input_clauses consists of id values for cnf file input*)
  let all_clauses=(constraints n)@input_clauses in  (*all clauses consists of default constraints and input_clauses =*)
  Printf.printf "p cnf %d %d\n" (grid_size * grid_size * grid_size) (List.length all_clauses);
  List.iter (fun cl -> List.iter (Printf.printf "%d ") cl; Printf.printf "0\n") all_clauses