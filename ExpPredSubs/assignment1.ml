(*PART 1*)
type symbol = string*int
type signature = symbol list
(*symbol and signature defined as per instructions*)
exception InvalidPosition of string
(*Error handling for cases where position not present in edit*)

(*SELF MADE map,fold_left,flatten,filter (although less helpful due to arrays and hashtabl used)*)
let rec map f s = match s with
| [] -> []
| x::xs -> (f x)::(map f xs)

let rec fold_left f e s  = match s with
  | [] -> e 
  | x::xs -> fold_left f (f e x) xs

let flatten lists = 
  fold_left (fun curr acc-> curr@acc) [] lists

let rec filter p s = match s with
| [] -> []
| x :: xs -> if (p x) then x :: (filter p xs) else (filter p xs)

(* Check sig function returns true when arity >= 0 and unique symbols*)
let check_sig signature =
  let symbols = map fst signature in
  let arities = map snd signature in

  let arities_valid = fold_left(fun acc a -> a>=0 && acc)  true arities in

  let symbols_valid  = 
    let unique_sym sym = 
      let present = filter (fun s ->  s = sym) symbols in
      if List.length present > 1 then false else true
    in
    fold_left (fun acc a-> a&&acc) true (map unique_sym symbols) in
  arities_valid && symbols_valid

(*PART 2*)
(* Defining modules for symbol variable and expressions for easier implementation of self made types in future*)
  module type SYMBOL = sig
    type t
    val name : t -> string
    val arity : t -> int
  end

  module type VARIABLE = sig
    type t
    val compare : t-> t ->int (*Necessary for sort and adjacent functions*)
    val hash : t->int  (*For hashtabl*)
  end

  (* Expression module*)
  module EXP (S : SYMBOL)(V :VARIABLE) = struct
    type variable = V.t
    type symbol = S.t
    type exp = 
    | V of variable 
    | Node of symbol * (exp array)

(*Well formed exp check involves arity equals children*)
    let rec wfexp e = match e with
    | V _ -> true
    | Node(s,children) -> Array.length children = S.arity s &&
                      Array.fold_left (fun acc a -> a&&acc) true (Array.map wfexp (children))

(*Height function*)
    let rec ht e = match e with
    | V _ -> 0
    | Node(s,children) -> if Array.length children = 0 then 0
                        else  1 + Array.fold_left(fun acc child-> max acc child) 0 (Array.map ht children)

(*Size function*)
    let rec size e = match e with
    | V _ -> 1
    | Node(s,children) -> 1 + Array.fold_left(fun acc child -> acc+child) 0 (Array.map size children)
    

(*Duplicates removal in O(nlog n) by sorting then removing*)
    let rec duplicates compare lst =
    match lst with
    | h1 :: h2 :: t ->
        if compare h1 h2 = 0 then
          duplicates compare (h1 :: t)
        else
          h1 :: duplicates compare (h2 :: t)
    | _ -> lst

(*Unique vars in the list*)
    let rec vars e = match e with
    | V var -> [var]
    | Node (s,children) -> duplicates V.compare (List.sort V.compare (flatten(Array.to_list(Array.map vars children))))


(*PART 3*)
(*Hashtabl used to access variables and correspponding subst in O(1)*)
    type substitution = (variable,exp) Hashtbl.t
    type position = int list (*To be given*)

(*Using hashtabl for O(1)*)
    let find_in_s (s:substitution)(v:variable) : exp = 
    if (Hashtbl.mem s v) then Hashtbl.find s v 
    else V v 

(*Subst function to change variables to substituted in expressions*)
    let rec subst (s:substitution)(e:exp) =
      match e with
      V v -> find_in_s s v
      | Node(sy,children) -> Node (sy,Array.map (subst s) children )

(*Composition for one after another substituition into two cases*)

    let composition (s1 : substitution)(s2:substitution):substitution=
    let compose = Hashtbl.create (Hashtbl.length s1 + Hashtbl.length s2)  in 
        (*Either replace all s1 output with s2 and if not present just simply add directly*)
        Hashtbl.iter (fun v e -> Hashtbl.add compose v (subst s1 e)) s2 ;
      Hashtbl.iter (fun v e -> if not (Hashtbl.mem s2 v) then Hashtbl.add compose v e) s1;
    compose

(*Edit uses input position and exp to subst them (not in_situ)*)
    let rec edit (e:exp)(p: position)(sub:exp) = 
      match p with
      | [] -> sub
      | x :: xs ->
      match e with
      (*Exeception in cases where we reach variable ie leaf reached before*)
      | V _ -> raise (InvalidPosition "Invalid position: reached a leaf too early")
      | Node (sym, children) ->
          if x < 0 || x >= Array.length children then 
            raise (InvalidPosition"Invalid position: index out of range")
          else
            let updated_children = Array.copy children in
            updated_children.(x) <- edit children.(x) xs sub;
            Node (sym, updated_children)

(*In_situ_subst substitutes in place the variables with exapressions*)
    let rec in_situ_subst (s: substitution)(e : exp) =
      match e with
      V _ -> ()
      | Node(_,children) -> 
                for i = 0 to Array.length children - 1 do
        match children.(i) with
        | V v -> 
            if(Hashtbl.mem s v) then children.(i) <- Hashtbl.find s v
            else ()
        | Node (sym,child) ->in_situ_subst s children.(i)
      done
  end
(*PART 4*)
(*CREATING SYM,VAR,E as classes for above expressed sig*)
module SYM = struct
  type t = string*int
  let name (n,_)  = n
  let arity (_,a) = a 
  
end

module VAR  = struct
  type t = string
  let compare = String.compare
  let hash = Hashtbl.hash
end

module E = EXP(SYM)(VAR)
module type PRED_SYMBOL = sig 
  type t
  val name : t ->string
  val arity : t->int
end
(*PART 5*)
(*Similar to above functions*)
module Predexp (P : PRED_SYMBOL) = struct 
  type predicate = P.t
  type pred = T
            | F
            |Not of pred
            |And of pred*pred
            |Or of pred*pred
            |Pred of predicate*(E.exp array)
(*AND OR NOT PRED are additional expressions*)
  let rec wff p = match p with
  |T|F -> true
  | Pred(ps,arr) -> Array.length arr = P.arity ps &&Array.fold_left(fun acc e -> acc && E.wfexp e) true arr
  | Not p1 -> wff p1
  | And (p1, p2) 
  | Or (p1, p2) -> wff p1 && wff p2
  

  let rec psubst (s : E.substitution) (p : pred)=
    match p with
    | T -> T
    | F -> F
    | Pred (ps, arr) -> Pred (ps, Array.map (E.subst s) arr)
    | Not p1 -> Not (psubst s p1)
    | And (p1, p2) -> And (psubst s p1, psubst s p2)
    | Or (p1, p2) -> Or (psubst s p1, psubst s p2)
  
(*Temp hashtabl created since it takes hashtabl as input*)
  let wp (v : E.variable) (e : E.exp) (p : pred) : pred =
    let s = Hashtbl.create 1 in
    Hashtbl.add s v e ;
    psubst s p

end

