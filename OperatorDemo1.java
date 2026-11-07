package com.itheima.operator;

import java.sql.SQLOutput;

public class OperatorDemo1 {
    public static void main(String[] args) {
/*
        算数运算符：+ - * / %
        整数计算细节：结果都是整数，即商
        小数细节：结果可能不精确,如下
     */
        double a = 10.0;
        double b = 3.0;
        double c = a/b;
        System.out.println(c);//3.3333333333333335
    }
}
