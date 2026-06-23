.A: 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
addi x1 x0 50
addi x2 x0 2
mul x3 x2 x2
blt x1 x3 10
lw x4 0(x2)
bne x4 x0 6
addi x5 x3 0
addi x6 x0 1
sw x6 0(x5)
add x5 x5 x2
blt x5 x1 -3
addi x2 x2 1
blt x2 x1 -10
addi x10 x0 2
addi x20 x0 0
lw x11 0(x10)
bne x11 x0 2
addi x20 x20 1
addi x10 x10 1
blt x10 x1 -4
