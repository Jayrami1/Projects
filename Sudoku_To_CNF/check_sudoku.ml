open Printf

let read_lines f = 
  let c = open_in f in 
  let rec r () = try let l = input_line c in l :: r () with End_of_file -> close_in c; [] in 
  Array.of_list (r ())

let to_val c = 
  match c with '0'..'9' -> int_of_char c - 48 | 'A'..'F' -> int_of_char c - 55 | 'a'..'f' -> int_of_char c - 87 | _ -> -1

let () =
  if Array.length Sys.argv < 3 then (printf "usage: ./check_sudoku output.txt input.txt\n"; exit 1);
  let sol = read_lines Sys.argv.(1) and orig = read_lines Sys.argv.(2) in
  let size = String.length (String.trim sol.(0)) in
  let n = int_of_float (sqrt (float_of_int size)) in
  let grid = Array.make_matrix size size 0 in

  let fail msg = printf "fail: %s\n" msg; exit 1 in
  let check_uniq lst name = 
  let s = Array.make (size + 1) false in 
  List.iter (fun x -> 
    if x <> -1 then (
      if s.(x) then fail ("duplicate " ^ (sprintf "%X" x) ^ " in " ^ name); 
      s.(x) <- true
    )
  ) lst 
in
  for r = 0 to size - 1 do
    for c = 0 to size - 1 do
      let v = to_val sol.(r).[c] and o = to_val orig.(r).[c] in
      if v = -1 then fail (sprintf "empty cell at %d,%d" r c);
      if o <> -1 && v <> o then fail (sprintf "mismatch at %d,%d" r c);
      grid.(r).(c) <- v
    done
  done;

  for i = 0 to size - 1 do
    check_uniq (Array.to_list grid.(i)) (sprintf "Row %d" i);
    check_uniq (List.init size (fun r -> grid.(r).(i))) (sprintf "Col %d" i);
  done;

  for br = 0 to n - 1 do for bc = 0 to n - 1 do
    let b = ref [] in
    for r = 0 to n - 1 do for c = 0 to n - 1 do b := grid.(br*n+r).(bc*n+c) :: !b done done;
    check_uniq !b (sprintf "box %d,%d" br bc)
  done done;
  printf "pass: Valid Solution.\n"