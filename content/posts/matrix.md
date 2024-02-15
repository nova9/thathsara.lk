+++
title = 'Matrix'
date = 2024-01-14T07:07:07+01:00
draft = false
+++
## Definition:
A matrix is a two-dimensional array of numbers or expressions arranged in rows and columns. An m × n matrix A has m rows and n columns and is written as:

$$
A =
\begin{bmatrix}
a_{11} & a_{12} & \cdots & a_{1n} \\\
a_{21} & a_{22} & \cdots & a_{2n} \\\
\vdots & \vdots & \ddots & \vdots \\\
a_{m1} & a_{m2} & \cdots & a_{mn}
\end{bmatrix}
$$

where the element \\( a_{ij} \\) is located in the \\( i^{th} \\) row and the \\( j^{th} \\) column.  

*Notations:*  
\\( \mathbb{M}_{m \times n} (\mathbb{R}) \\) – the set of all \\( m \times n \\) matrices with real numbers as its elements.  

## Special Matrices  

1. ### Square Matrix:
If the number of rows and the number of columns of a matrix are equal, then it is called a square matrix.  

2. ### Zero Matrix:
A zero matrix or null matrix is a matrix with all elements equal to zero.  

3. ### Diagonal Matrix:
A square matrix is said to be diagonal if each one of the non-diagonal entries is zero.  

4. ### Scalar Matrix:
A diagonal matrix in which all the diagonal entries are equal is said to be a scalar matrix.  

5. ### Column Vector or Column Matrix:
A matrix with only one column is called a column vector or column matrix.  

6. ### Row Vector or Row Matrix:
A matrix with only one row is called a row vector or row matrix.  

7. ### Upper Triangular Matrix:
A square matrix is said to be an upper triangular matrix if all its entries below the main diagonal are zero.  

8. ### Strictly Upper Triangular Matrix:
If the entries on the main diagonal of an upper triangular matrix are all zero, the matrix is said to be strictly upper triangular.  

9. ### Lower Triangular Matrix:
A square matrix is said to be a lower triangular matrix if all its entries above the main diagonal are zero.  

10. ### Strictly Lower Triangular Matrix:
If the entries on the main diagonal of a lower triangular matrix are all zero, the matrix is said to be strictly lower triangular.  

11. ### Identity Matrix:
A square matrix in which all the main diagonal elements are 1’s and all the remaining elements are 0’s is called an identity matrix.  

## Equality of Matrices
Two matrices are equal if they have the same size and the same corresponding entries.  

## Operations on Matrices

- Addition of Matrices: The addition of A and B is denoted by \\( A + B \\), and is defined as \\( A + B = [a_{ij} + b_{ij}]_{m \times n} \\).  
- Subtraction of Matrices: The subtraction of A and B is denoted by \\( A - B \\), and is defined as \\( A - B = [a_{ij} - b_{ij}]_{m \times n} \\).  
- Scalar Multiplication: The scalar multiplication of A with a real number c is denoted by \\( cA \\) and is defined as \\( cA = [ca_{ij}]_{m \times n} \\).  

## Theorem 1.1
Let \\( \mathbb{M}\_{m \times n} (\mathbb{R}) \\) 
be the collection of all \\( m \times n \\) matrices over the field of real numbers. If A, B, C \\( \in \mathbb{M}\_{m \times n} (\mathbb{R}) \\) and \\( \alpha, \beta \in \mathbb{R} \\), then:  
1. \\( A + B = B + A \\)  
2. \\( A + (B + C) = (A + B) + C \\)  
3. \\( A + 0 = A \\)  
4. \\( A + (-A) = 0 \\)  
5. \\( (\alpha + \beta)A = \alpha A + \beta A \\)  
6. \\( \alpha (A + B) = \alpha A + \alpha B \\)  
7. \\( (\alpha \beta) A = \alpha (\beta A) \\)  
8. \\( 1A = A \\)  

These properties show that the set \\( \mathbb{M}_{m \times n} (\mathbb{R}) \\) of all \\( m \times n \\) matrices is a vector space over the field of real numbers.  

**References**  
- Lay, D.C., Lay, S.R., & McDonald, J.J. (2016). *Linear Algebra and its Applications* (5th ed.). Pearson.
