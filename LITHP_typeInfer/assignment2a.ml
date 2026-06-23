type sign = Neg | NonNeg
type bigint = B of sign*(int list)
type myBool = T | F

exception Division_by_zero
(*Helper functions*)

(* Function to remove starting zeroes *)
let strip_zeros lst =
  let rec aux = function
    | 0 :: [] -> [0]
    | 0 :: tl -> aux tl
    | lst -> lst
  in aux lst

(*Unary operators for absolute value and negation*)
let abs_val (B(_, l)) = B(NonNeg, l)
let neg (B(s, l)) = if l = [0] then B(NonNeg, [0]) else B((if s = Neg then NonNeg else Neg), l)

(*Creates a list of pairs after padding the lesser length List for fold_left functionality*)
let prepare_lists l1 l2 =
  let rec aux a b acc =
    match a, b with
    | [], [] -> acc
    | x::xs, y::ys -> aux xs ys ((x, y) :: acc)
    | x::xs, [] -> aux xs [] ((x, 0) :: acc)
    | [], y::ys -> aux [] ys ((0, y) :: acc)
  in
  aux (List.rev l1) (List.rev l2) []


(*COMPARISION OPERATORS (cuz required for addition and subtraction)*)
(*General comparision operator that gives -1 for less than 0 for equal and 1 for greater than*)
let comparision (B(s1,l1)) (B(s2,l2)) = 
  match (s1,s2) with
  (NonNeg,Neg) -> 1
  | (Neg,NonNeg) -> -1
  | (s,_) -> let len1  = List.length l1 in
              let len2  = List.length l2 in
              let cmp = if len1<>len2 then compare len1 len2        (*First baseg on signs then based on direct list compare functionality on each element*)
              else List.fold_left (fun acc (d1, d2) -> 
              if acc <> 0 then acc else compare d1 d2
            ) 0 (prepare_lists l1 l2)
      in
      if s = NonNeg then cmp else -cmp (*Based on sign final comparision is decided*)

(*Function for eq,gt,lt,gte,lte using the general comparision function*)
let equal a b = if comparision a b = 0 then T else F
let greater_than a b = if comparision a b > 0 then T else F
let less_than a b = if comparision a b < 0 then T else F
let great_or_equal a b = if comparision a b >= 0 then T else F
let less_or_equal a b = if comparision a b <= 0 then T else F

(*ADDITION and SUBTRACTION*)
(*Adds magnitudes favourable since sub or add can directly be wriiten*)
let add_mags l1 l2 = 
  let p = List.rev(prepare_lists l1 l2) in
  let (carry,res) = List.fold_left (fun (c,acc) (d1,d2) -> 
    let s = c+d1+d2 in (s/10,(s mod 10) :: acc)) (0 , []) p in  (*Based on normal ripple carry adder*)
    if carry > 0 then (carry :: res) else (res)

(*assume l1 > = l2*)
(*Subtracts the magnitude of numbers for similar reason*)
let sub_mags l1 l2 =
  let p = List.rev(prepare_lists l1 l2) in 
  let (brw , res) = List.fold_left(fun (b,acc)(d1,d2)->     (*Taking borrow for neighbouring element in case diff becomes negative*)
    let diff = d1 - d2 - b in if diff < 0 then (1,(10+diff) :: acc) else (0,diff :: acc)) (0,[]) p in
    strip_zeros(res)  (*Strip zeroes necessary here*)

let add (B(s1,l1)) (B(s2,l2)) =             (*Broken down into same sign (mag adds) or different signs(mag subtracts)*)
  if (s1 = s2) then B(s1,add_mags l1 l2)
  else if (great_or_equal (B(NonNeg,l1)) (B(NonNeg,l2)) = T) then (B(s1, sub_mags l1 l2))
  else (B(s2,sub_mags l2 l1)) 

let sub a b = add a (neg b)   (*Basically sub is just make second term negative and adding them*)

(*MULTIPLICATION*)
(*Multiplication just uses helper function to multiply with each digit at a time then shifting according to decimal place*)
let multiply (B(s1,l1)) (B(s2,l2)) = 
  let s = if s1 = s2 then NonNeg else Neg in  (*Sign judged by same or differnet*)
  let mul l d =   (*Helper for each digit multiplication*)
    let (carry,res) = List.fold_left (fun (c,arr) x -> let s = x*d + c in (s/10,(s mod 10)::arr)) (0,[]) (List.rev l) in
    if carry>0 then carry :: res else res 
  in
  let (_,ans) = List.fold_left(fun (shift,acc) d -> let p = ((mul l1 d) @ (List.init shift (fun _ -> 0))) in (shift + 1 ,add_mags p acc)) (0,[0]) (List.rev l2) in
      neg(neg (B(s,strip_zeros ans)))   (*Dont worry it for cases like negative zero (neg takes carry for it)*)

(*O(N*M) DIVISION*)
(*Exception raised when divided by zero*)
let division (B(s1,l1)) (B(s2,l2)) = 
  if l2 = [0] then raise Division_by_zero
  else
    let s = if s1 = s2 then NonNeg else Neg in
    (*at each step quotient and remainder list is maintained*)
    let (quo,rem) = List.fold_left(fun (q_acc,r_acc) d -> let curr_r = (B(NonNeg,strip_zeros(r_acc @ [d]))) in (*Digit drop down from dividend*)
    let rec find_q count curr = if (((less_than curr (B(NonNeg,l2))) = T)) then (count,curr) (*Rec function which checks how many times i can subtract divisor from rem*)
    else
      let B(_, curr_mag) = curr in
      find_q (count+1) (B(NonNeg, sub_mags curr_mag l2)) in      
      let (next_q , next_r) = find_q 0 curr_r in 
      let B(_, next_r_mag) = next_r in (q_acc @ [next_q], next_r_mag)
    ) ([],[]) l1 in
    (neg(neg (B(s,strip_zeros quo))),neg(neg (B(s1,strip_zeros rem))))  (*Neg neg for zero case*)

let quotient a b = fst (division a b)   (*Implicit function derived from the pair of quotient list and remainder list*)
let remainder a b = snd (division a b)  

(*INT to BIG_INT*)
(*converting int to big_int*)
let int_to_big_int n =    (*Sign judged by int sign*)
  if n = 0 then B(NonNeg,[0]) 
  else
    let s = if n < 0 then Neg else NonNeg in
    let rec  to_list x = if x = 0 then [] else (x mod 10) :: (to_list (x/10)) in (*Adding each element to list one by one then reversing*)
      (B(s,List.rev(to_list(abs n))))

let big_int_to_string (B(s,l)) =     (*big_int to string conversion to see integers as they cross int limits easily*)
  let str = if s = Neg then "-" else "" in      (*sign is - or (+) but pretty printing often ignores it*)
  str ^ List.fold_left (^) "" (List.map string_of_int l)  (*Map int list to string list then using foldleft concatenate to string *)
