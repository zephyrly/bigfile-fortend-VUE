/*
 * @Date: 2023-05-31 10:06:28
 * @LastEditors: okzfans
 * @LastEditTime: 2023-05-31 15:11:50
 * @Description: nothing
 * Copyright (c) 2023 by okzfans, All Rights Reserved. 
 */
const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  lintOnSave:false,
  devServer:{
    proxy:{
      '/api/':{
        target:'http://127.0.0.1:7001',
        secure:false,
        changeOrigin:true,
        pathRewrite:{
          '^/api':''
        }
      }
    }
  }
})
