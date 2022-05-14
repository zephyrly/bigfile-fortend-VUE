<template>
    <div class="wrap">
        <div >
           <el-upload
             ref="file"
             :http-request="handleFileUpload"
             action="#"
             class="avatar-uploader"
             :show-file-list='false'
           >
               <el-button type="primary">上传文件</el-button>
           </el-upload>
           <div style="width:80%; padding-top:20px;margin:0 auto">
               <div>计算hash的进度：</div>
              <el-progress :stroke-width="20" :text-inside="true" :percentage="hashProgress"></el-progress> 
           </div>
           <div style="width:80%; padding-top:20px;margin:0 auto">
               <div>上传进度：</div>
              <el-progress :stroke-width="20" :text-inside="true" :percentage="uploaedProgress"></el-progress> 
           </div>
           <h3 >切片上传进度：</h3>
           <div class="container" :style="{width:cubeWidth+'px'}">
               
                <div class="cube" v-for="chunk in chunks" :key="chunk.name">
                    <div :class="{
                      'uploading':chunk.progress>0 && chunk.progress<100,
                      'success':chunk.progress==100,
                      'error':chunk.progress<0
                    }"
                    :style="{height:chunk.progress+'%'}"
                    >
                      <i class="el-icon-loading" :style="{color:'#f56c6c',}" v-if="chunk.progress<100 && chunk.progress>0"></i>
                    </div>
                     
                </div>
           </div>
           
        </div>
    </div>
</template>

<script>
    const CHUNK_SIZE=8*1024*1024
    import sparkMD5 from 'spark-md5'
    export default {
        name:'file-upload',
        data(){
            return {
              file:null,
              chunks:[],
              hashProgress:0,
              hash:''
            }
        },
        computed:{
            uploaedProgress(){
                if(!this.file || !this.chunks.length){
                    return 0
                }
               const loaded =this.chunks.map(chunk=>{
                   const size=chunk.chunk.size
                   const chunk_loaded=chunk.progress/100*size
                   return chunk_loaded
                }).reduce((acc,cur)=>acc+cur,0)
    
               return parseInt(((loaded*100)/this.file.size).toFixed(2))
            },
            cubeWidth(){
               return Math.ceil(Math.sqrt(this.chunks.length))*20
            }
        },

        methods:{
            handleFileChange(e){
                console.log(e)
            
            },
            async handleFileUpload(e){
              const {file=null}=e
              if(!file){
                  return 
              }
              this.file=file
              this.upload()
            },
            async upload(){
              //切片
              const chunks=this.createFileChunk(this.file)
              //hash
              const hash=await this.calculateHash1(chunks)

              this.hash=hash
              //查询是否上传
              this.$http.post('/checkfile',{
                  hash,
                  ext:this.file.name.split('.').pop()
              })
              .then(res=>{
                  if(!res || !res.data){
                      return
                  }
                   const {uploaded,uploadedList}=res.data
                    if(uploaded){
                        return  this.$message.success('秒传成功')
                    }

                    this.chunks=chunks.map((chunk,index)=>{
                        const name=hash+'-'+index
                        // const upLoadedChunk=uploadedList.find(item=>item.name==name)
                        const isChunkUploaded=(uploadedList.includes(name))?true:false
                        return {
                            hash,
                            name,
                            index,
                            chunk:chunk.file,
                            progress:isChunkUploaded?100:0
                        }
                    })
                    //上传没有hash计算的切片
                    this.uploadChunks(uploadedList)
              })
            },

            async uploadChunks(uploadedList){
              console.log(this.chunks)
              const requests=this.chunks.filter(chunk=>!uploadedList.includes(chunk.name))
              .map((chunk,index)=>{
                 const form=new FormData()
                 form.append('chunk',chunk.chunk)
                 form.append('hash',chunk.hash)
                 form.append('name',chunk.name)
                 return {form,index:chunk.index,error:0}
              })
            //   .map(({form,index})=>{
            //       return this.$http.post('/uploadfile',form,{
            //           onUploadProgress:progress=>{
            //               this.chunks[index].progress=Number(((progress.loaded/progress.total)*100).toFixed(2))
            //           }
            //       })
            //   })
            // //   console.log(requests)
            //   Promise.all(requests).then((res)=>{
            //     console.log(res)
            //     this.mergeFile()
            //   })
            
            const sendRequest=(limit=1,task=[])=>{
                let count=0
                let isStop=false
                const len=requests.length
                return new Promise((resolve,reject)=>{
                        const upLoadReq=()=>{
                            if(isStop){
                                return
                            }
                            const req=requests.shift()
                            if(!req){
                                return
                            }
                            const {form,index}=req
                            this.$http.post('/uploadfile',form,{
                                onUploadProgress:progress=>{
                                    this.chunks[index].progress=Number(((progress.loaded/progress.total)*100).toFixed(2))
                                }
                            })
                            .then(res=>{
                                //最后一片
                                if(count==len-1){
                                resolve()
                                }else{
                                count++
                                upLoadReq()
                                }
                            })
                            .catch(err=>{
                                this.chunks[index].progress=-1
                                if(req.error<3){
                                    req.error++
                                    requests.unshift(req)
                                    upLoadReq()
                                }else{
                                    isStop=true
                                    reject()
                                }
                            })
                        }

                        while(limit>0){
                          setTimeout(()=>{
                            upLoadReq()
                          },Math.random()*2000)
                          limit--
                        }
                })

            }

               sendRequest(3).then(res=>{
                  console.log(res)
                  this.mergeFile()
               })
               
            },
            mergeFile(){
                // const {ext,size,hash}=body
                this.$http.post('/mergeFile',{
                    ext:this.file.name.split('.').pop(),
                    size:CHUNK_SIZE,
                    hash:this.hash
                }).then(res=>{
                    if(res && res.data){
                        console.log(res.data)
                    }
                })
            },
            createFileChunk(size=CHUNK_SIZE){
              const chunks=[];
              let cur=0;
              const maxLen=Math.ceil(this.file.size/CHUNK_SIZE)
              while(cur<maxLen){
                 const start=cur*CHUNK_SIZE;
                 const end = ((start + CHUNK_SIZE) >= this.file.size) ? this.file.size : start + CHUNK_SIZE;
                 chunks.push({index:cur,file:this.file.slice(start,end)})
                 cur++
              }
              return chunks
            },
            calculateHash1(chunks){
               const spark=new sparkMD5.ArrayBuffer()
               let count =0
               const len=chunks.length
               let hash
               const self=this
               const startTime = new Date().getTime()
               return new Promise((resolve)=>{
                    const loadNext=index=>{
                        const reader=new FileReader()
                        reader.readAsArrayBuffer(chunks[index].file)
                        reader.onload=function(e){
                            const endTime=new Date().getTime()
                            chunks[count]={...chunks[count],time:endTime-startTime}
                            count++
                            spark.append(e.target.result)
                            if(count==len){
                                self.hashProgress=100
                                 hash=spark.end()
                                 resolve(hash)
                            }else{
                                self.hashProgress+=100/len
                                loadNext(index+1)
                            }
                        }
                    }
                    loadNext(0)
                    // this.blockMoveStop()
               })

            },

        }
    }
</script>

<style scoped lang="scss">
  .wrapBox{
    position: relative;
  }
    #block{
    width:100px;
    height: 100px;
    background: red;
    position: absolute;
    }
 .container{
     display: flex;
     flex-wrap: wrap;
     margin: 20px auto;
     .cube{
       width:18px;
       height: 18px;
       border: 1px solid #000;
       background-color:#eee;
       .success{
           background: green;
       }
       .uploading{
           background: blue;
       }
       .error{
           background: red;
       }
     }
 }
</style>