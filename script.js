var canvas;
var ctx;
var cursorstr="▮";
var cursorendstr="▯";
var lineBreakRegex=/\r?\n/g;
var itemSeparatorRegex=/[\t ,]/g;
window.onload=function (){
  console.clear();
  canvas=dg("output");
  ctx=canvas.getContext("2d");
  dg('input').onkeydown=handlekey;
  dg('input').onfocus=handlekey;
  dg('input').onmousedown=handlekey;
  load();
  requestDraw(true);
  drawIntervalLoopFunc();
  setInterval(function(){if(hasRequestedDraw&&Date.now()-lastDrawByRequest>=1000)requestAnimationFrame(_processDrawRequest);},100);
}
function drawIntervalLoopFunc(){
  setTimeout(function(){if(document.activeElement==dg("input"))requestDraw(true);drawIntervalLoopFunc();},100);
}
var hasRequestedDraw=false;
var hasRequestedRecalculation=false;
var lastDrawByRequest=Date.now();
function requestDraw(recalculate){
  hasRequestedRecalculation=hasRequestedRecalculation||recalculate;
  if (!hasRequestedDraw){
    requestAnimationFrame(_processDrawRequest);
    hasRequestedDraw=true;
  }
}
function _processDrawRequest(){
  if (timesDrawn-doneDrawn>50) return;
  lastDrawByRequest=Date.now();
  try{
    draw(hasRequestedRecalculation);
  }catch(e){
    requestAnimationFrame(_processDrawRequest);
    throw e;
  }
  hasRequestedDraw=false;
  hasRequestedRecalculation=false;
}
function dg(s){
  return document.getElementById(s);
}
var calculatedMountain=null;
function parseSequenceElement(s,i){
  var strremoved=s;
  if (strremoved.indexOf(cursorstr)!=-1){
    strremoved=strremoved.substring(0,strremoved.indexOf(cursorstr))+strremoved.substring(strremoved.indexOf(cursorstr)+1);
  }
  if (strremoved.indexOf(cursorendstr)!=-1){
    strremoved=strremoved.substring(0,strremoved.indexOf(cursorendstr))+strremoved.substring(strremoved.indexOf(cursorendstr)+1);
  }
  if (strremoved.indexOf("v")==-1||!isFinite(Number(strremoved.substring(strremoved.indexOf("v")+1)))){
    var numval=Number(strremoved);
    return {
      value:numval,
      strexp:getstrexp(s,strremoved),
      position:i,
      parentIndex:-1
    };
  }else{
    return {
      value:Number(strremoved.substring(0,strremoved.indexOf("v"))),
      strexp:getstrexp(s,strremoved),
      position:i,
      parentIndex:Math.max(Math.min(i-1,Number(strremoved.substring(strremoved.indexOf("v")+1))),-1),
      forcedParent:true
    };
  }
}
function equalVector(s,t,d){
  if (d===undefined) d=0;
  for (var i=d;i<Math.max(s.length,t.length);i++){
    if ((s[i]||0)!=(t[i]||0)) return false;
  }
  return true;
}
function addVector(s,t){
  var r=[];
  for (var i=0;i<Math.max(s.length,t.length);i++){
    r.push((s[i]||0)+(t[i]||0));
  }
  return r;
}
function stBasis(d){
  var r=[];
  while (r.length<d) r.push(0);
  r.push(1);
  return r;
}
function basis(d,k){
  var r=[];
  while (r.length<d) r.push(0);
  r.push(k);
  return r;
}
function incrementCoord(s,d){
  var r=s.slice(0);
  for (var i=0;i<d;i++) r[i]=0;
  return addVector(r,stBasis(d));
}
function addCoord(s,d,k){
  var r=s.slice(0);
  for (var i=0;i<d;i++) r[i]=0;
  return addVector(r,basis(d,k));
}
function sumArray(s){
  var r=0;
  for (var i=0;i<s.length;i++) r+=s[i];
  return r;
}
function calcMountain(s,maxDim=Infinity){
  if (maxDim===undefined) maxDim=Infinity;
  var coordOffset=typeof s=="object"?s.coord:[];
  if (typeof s=="string"){
    s=s.split(itemSeparatorRegex).map(parseSequenceElement);
  }
  if (s instanceof Array&&s.length<=1){
    return {
      dim:1,
      arr:[{
        dim:0,
        value:s[0].value,
        strexp:s[0].strexp,
        position:s[0].position,
        coord:coordOffset.slice(0),
        parentIndex:s[0].parentIndex,
        forcedParent:s[0].forcedParent,
        leftLegCoord:null,
        rightLegCoord:null
      }],
      coord:coordOffset.slice(0)
    };
  }else if (!(s instanceof Array)&&s.arr.length<=1){
    return s.arr[0];
  }else{
    var m;
    if (s instanceof Array){
      m={
        dim:1,
        arr:[],
        coord:coordOffset.slice(0)
      };
      for (var i=0;i<s.length;i++){
        m.arr.push({
          dim:0,
          value:s[i].value,
          strexp:s[i].strexp,
          position:s[i].position,
          coord:addCoord(coordOffset,0,i),
          parentIndex:s[i].parentIndex,
          forcedParent:s[i].forcedParent,
          leftLegCoord:null,
          rightLegCoord:null
        });
        if (!s[i].forcedParent){
          for (var j=i;j>=0;j--){
            if (s[j].value<s[i].value){
              m.arr[i].parentIndex=j;
              break;
            }
          }
        }
      }
    }else{
      m=s;
    }
    var lastPosition=sumArray(m.arr[m.arr.length-1].coord);
    var dimensions=1;
    while (dimensions<=maxDim){
      var uppers=calcDifference(m);
      if (uppers.arr.length<1) break;
      var upperm=calcMountain(uppers,dimensions);
      var upperdim=upperm.dim;
      var raisedupperm=upperm;
      while (raisedupperm.dim<=dimensions){
        raisedupperm={
          dim:raisedupperm.dim+1,
          arr:[raisedupperm],
          coord:raisedupperm.coord.slice(0)
        };
      }
      raisedupperm.coord=coordOffset.slice(0);
      raisedupperm.arr.unshift(m);
      m=raisedupperm;
      dimensions++;
    }
    return m;
  }
}
function calcDifference(m){
  var coordOffset=incrementCoord(m.coord,m.dim);
  var rightLegs=[];
  var rightLegCoords=[];
  var rightLegTree=[];
  var rightLegPositions=[];
  if (m.dim==1){
    for (var i=0;i<m.arr.length;i++){
      rightLegs.push(m.arr[i]);
      rightLegCoords.push(m.arr[i].coord);
      rightLegTree.push(m.arr[i].parentIndex);
      rightLegPositions.push(sumArray(m.arr[i].coord));
    }
  }else{
    for (var i=0;i<=getLastPosition(m);i++){
      var node=findHighestWithPosition(m,i);
      if (node) rightLegPositions.push(i);
    }
    for (var i=0;i<rightLegPositions.length;i++){
      var node=findHighestWithPosition(m,rightLegPositions[i]);
      rightLegs.push(node);
      rightLegCoords.push(node.coord);
      var pn=node;
      while (pn){
        var ppn=parent(m,pn);
        if (!ppn) ppn=leftLeg(m,pn);
        if (!ppn){
          rightLegTree.push(-1);
          break;
        }
        pn=ppn;
        if (pn.parentIndex==-1&&(pn.coord[m.dim-1]||0)<(node.coord[m.dim-1]||0)&&rightLegPositions.indexOf(sumArray(pn.coord))!=-1){
          rightLegTree.push(rightLegPositions.indexOf(sumArray(pn.coord)));
          break;
        }
      }
      if (!pn) rightLegTree.push(-1);
    }
  }
  var rightLegInR=[];
  var rInRightLeg=[];
  var rightLegParents=[];
  var r={
    dim:1,
    arr:[],
    coord:coordOffset
  };
  for (var i=0;i<rightLegs.length;i++){
    var pi=i;
    while (pi>-1&&!(rightLegs[pi].value<rightLegs[i].value)) pi=rightLegTree[pi];
    rightLegParents.push(pi);
    if (pi!=-1){
      rightLegInR.push(r.arr.length);
      rInRightLeg.push(i);
      r.arr.push({
        dim:0,
        value:rightLegs[i].value-rightLegs[pi].value,
        position:rightLegPositions[i],
        coord:addCoord(coordOffset,0,rightLegPositions[i]-sumArray(coordOffset)),
        parentIndex:-1,
        forcedParent:true,
        leftLegCoord:rightLegCoords[pi].slice(0),
        rightLegCoord:rightLegCoords[i].slice(0)
      });
    }else{
      rightLegInR.push(-1);
    }
  }
  for (var i=0;i<r.arr.length;i++){
    var pi=rInRightLeg[i];
    while (true){
      var ppi=rightLegParents[pi];
      if (ppi==-1||rightLegInR[ppi]==-1) break;
      pi=ppi;
      if (r.arr[rightLegInR[pi]].value<r.arr[i].value){
        r.arr[i].parentIndex=rightLegInR[pi];
        break;
      }
    }
  }
  return r;
}
function indexFromCoord(m,coord,d){
  if (d===undefined) d=0;
  var r=[];
  while (true){
    if (m.dim<=d){
      if (equalVector(m.coord,coord,d)) return r;
      else null;
    }
    for (var i=0;i<m.arr.length;i++){
      if (equalVector(m.arr[i].coord,coord,m.arr[i].dim)){
        r.push(i);
        m=m.arr[i];
        break;
      }
      if (i==m.arr.length-1) return null;
    }
  }
}
function findByIndex(m,index){
  if (!index) return null;
  for (var i=0;i<index.length;i++) m=m.arr[index[i]<0?m.arr.length+index[i]:index[i]];
  return m;
}
function findByCoord(m,coord,d){
  return findByIndex(m,indexFromCoord(m,coord,d));
}
function getLastPosition(m){
  while (m.dim>1) m=m.arr[0];
  return m.arr[m.arr.length-1].position;
}
function findHighestWithPosition(m,position){
  if (m.dim==0){
    if (m.position==position) return m;
    else null;
  }else{
    for (var i=m.arr.length-1;i>=0;i--){
      var r=findHighestWithPosition(m.arr[i],position);
      if (r) return r;
    }
    return null;
  }
}
function parent(m,node){
  if (node.dim!=0||node.parentIndex==-1) return null;
  var index=indexFromCoord(m,node.coord);
  if (!index) return null;
  index[index.length-1]=node.parentIndex;
  return findByIndex(m,index);
}
function leftLeg(m,node){
  if (node.dim!=0||!node.leftLegCoord) return null;
  return findByCoord(m,node.leftLegCoord);
}
function rightLeg(m,node){
  if (node.dim!=0||!node.rightLegCoord) return null;
  return findByCoord(m,node.rightLegCoord);
}
function flattenMountain(m){
  var r={};
  if (m.dim==0){
    r[m.coord.join(",")]=m;
  }else{
    for (var i=0;i<m.arr.length;i++){
      Object.assign(r,flattenMountain(m.arr[i]));
    }
  }
  return r;
}
function getstrexp(s,strremoved){
  if (typeof strremoved=="undefined"){
    strremoved=s;
    if (strremoved.indexOf(cursorstr)!=-1){
      strremoved=strremoved.substring(0,strremoved.indexOf(cursorstr))+strremoved.substring(strremoved.indexOf(cursorstr)+1);
    }
    if (strremoved.indexOf(cursorendstr)!=-1){
      strremoved=strremoved.substring(0,strremoved.indexOf(cursorendstr))+strremoved.substring(strremoved.indexOf(cursorendstr)+1);
    }
  }
  if (strremoved.indexOf("v")==-1||!isFinite(Number(strremoved.substring(strremoved.indexOf("v")+1)))){
    return s;
  }else{
    if (s.indexOf(cursorstr)!=-1&&s.indexOf(cursorstr)>s.indexOf("v")||s.indexOf(cursorendstr)!=-1&&s.indexOf(cursorendstr)>s.indexOf("v")){
      return s;
    }else{
      return s.substring(0,s.indexOf("v"));
    }
  }
}
function updateMountainString(){
  for (var nums=inputc.split(itemSeparatorRegex),j=0;j<nums.length;j++){
    findByCoord(calculatedMountain,[j]).strexp=getstrexp(nums[j]);
  }
}
var options=["input","ROWHEIGHT","COLUMNWIDTH","LINETHICKNESS","NUMBERSIZE","NUMBERTHICKNESS","LINEPLACE","MAXDIMENSIONS","STACKMODE","HIGHLIGHT"];
var optionsWhichAffectMountain=["input","MAXDIMENSIONS"];
var input="";
var inputc="";
var ROWHEIGHT=32;
var COLUMNWIDTH=32;
var LINETHICKNESS=2;
var NUMBERSIZE=10;
var NUMBERTHICKNESS=400;
var LINEPLACE=1;
var MAXDIMENSIONS=10;
var STACKMODE=true;
var HIGHLIGHT=true;
var inputFocused=false;
var timesDrawn=0;
var finalDrawn=0;
var doneDrawn=0;
function draw(recalculate){
  var inputChanged=false;
  var optionChanged=false;
  for (var i of options){
    var newValue;
    if (dg(i).type=="number") newValue=dg(i).value;
    else if (dg(i).type=="text") newValue=dg(i).value;
    else if (dg(i).type=="range") newValue=dg(i).value;
    else if (dg(i).type=="checkbox") newValue=dg(i).checked;
    if (window[i]!=newValue) optionChanged=true;
    if (window[i]!=newValue&&optionsWhichAffectMountain.indexOf(i)!=-1) inputChanged=true;
    window[i]=newValue;
  }
  var curpos=form.input.selectionStart;
  var curendpos=form.input.selectionEnd;
  var highlightindex;
  var highlightendindex;
  var newinputc;
  if (!inputFocused){
    highlightindex=-1;
    highlightendindex=-1;
    newinputc = input;
  }else{
    highlightindex=(input.substring(0,curpos).match(/,/g)||[]).length;
    highlightendindex=(input.substring(0,curendpos).match(/,/g)||[]).length;
    console.log([highlightindex,highlightendindex]);
    if (curpos==curendpos){
      newinputc = input.substring(0,curpos)+cursorstr+input.substring(curpos);
    }else{
      newinputc = input.substring(0,curpos)+cursorstr+input.substring(curpos,curendpos)+cursorendstr+input.substring(curendpos);
    }
  }
  if (!optionChanged&&inputc==newinputc) return;
  inputc=newinputc;
  if (recalculate&&inputChanged) calculatedMountain=calcMountain(inputc,+MAXDIMENSIONS);
  else updateMountainString();
  if (STACKMODE){
    var rowpos={};
    for (var cycles=0;cycles<2;cycles++){
      var currentrow=0;
      var renderingindex=[0];
      var mm=calculatedMountain;
      for (var i=0;i<calculatedMountain.dim-1;i++){
        renderingindex.unshift(mm.arr.length-1);
        mm=mm.arr[mm.arr.length-1];
      }
      renderingindex.unshift(0);
      while (true){
        var mm=findByIndex(calculatedMountain,renderingindex.slice(1,-1).reverse());
        if (cycles){
          render1Dmountain(calculatedMountain,mm,rowpos);
        }else{
          rowpos[renderingindex.slice(1).join(",")]=currentrow;
        }
        currentrow++;
        for (var d=1;d<calculatedMountain.dim;d++){
          renderingindex[d]--;
          if (renderingindex[d]<0){
          }else{
            for (var dd=d-1;dd>=1;dd--){
              var mm=findByIndex(calculatedMountain,renderingindex.slice(dd+1,-1).reverse());
              renderingindex[dd]=mm.arr.length-1;
            }
            if (d>1) currentrow++;
            if (cycles&&d>1){
              var lines=d-1;
              ctx.beginPath();
              for (var i=0;i<lines;i++){
                var y=currentrow*ROWHEIGHT-NUMBERSIZE*Math.min(LINEPLACE,1)-(ROWHEIGHT-NUMBERSIZE)*Math.max(LINEPLACE-1,0)-3+ROWHEIGHT*(i+1)/(lines+1);
                ctx.moveTo(0,y);
                ctx.lineTo(canvas.width,y);
              }
              ctx.stroke();
            }
            break;
          }
        }
        if (d>=calculatedMountain.dim){
          if (!cycles){
            //resize
            canvas.width=findByIndex(calculatedMountain,"0".repeat(calculatedMountain.dim-1).split("")).arr.length*COLUMNWIDTH;
            canvas.height=(rowpos["0".repeat(calculatedMountain.dim).split("")]+1)*ROWHEIGHT;
            ctx.fillStyle="white"; //clear
            ctx.fillRect(0,0,canvas.width,canvas.height);
            if (HIGHLIGHT&&highlightindex!=-1){
              ctx.fillStyle="#ffaaaa";
              ctx.fillRect(highlightindex*COLUMNWIDTH,0,(highlightendindex-highlightindex+1)*COLUMNWIDTH,canvas.height);
            }
            ctx.fillStyle="black";
            ctx.strokeStyle="black";
            ctx.lineWidth=+LINETHICKNESS;
            ctx.font=NUMBERTHICKNESS+" "+NUMBERSIZE+"px Arial";
          }
          break;
        }
      }
    }
  }else{
    var bounds=[];
    for (var i=0;i<=Math.max(calculatedMountain.dim,2);i++){
      bounds.push({});
    }
    for (var cycles=0;cycles<2;cycles++){
      var renderingindex=[];
      var lasts=[];
      for (var i=0;i<=calculatedMountain.dim;i++){
        renderingindex.push(0);
        lasts.push(null);
      }
      if (cycles){
        //resize
        canvas.width=bounds[Math.max(calculatedMountain.dim,2)][renderingindex.slice(Math.max(calculatedMountain.dim,2)).join(",")].r;
        canvas.height=bounds[Math.max(calculatedMountain.dim,2)][renderingindex.slice(Math.max(calculatedMountain.dim,2)).join(",")].b;
        ctx.fillStyle="white"; //clear
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle="black";
        ctx.strokeStyle="black";
        ctx.lineWidth=+LINETHICKNESS;
        ctx.font=NUMBERTHICKNESS+" "+NUMBERSIZE+"px Arial";
      }
      while (true){
        var mm=findByIndex(calculatedMountain,renderingindex.slice(2,-1).reverse());
        if (cycles){
          render2Dmountain(mm,bounds[2][renderingindex.slice(2).join(",")].l,bounds[2][renderingindex.slice(2).join(",")].t);
        }else{
          bounds[2][renderingindex.slice(2).join(",")]={l:0,t:0};
          for (var d=2;d<calculatedMountain.dim;d+=2){
            if (lasts[d]){
              bounds[2][renderingindex.slice(2).join(",")].l=lasts[d].r+ +COLUMNWIDTH;
              break;
            }
          }
          for (var d=3;d<calculatedMountain.dim;d+=2){
            if (lasts[d]){
              bounds[2][renderingindex.slice(2).join(",")].t=lasts[d].b+ +ROWHEIGHT;
              break;
            }
          }
          bounds[2][renderingindex.slice(2).join(",")].r=bounds[2][renderingindex.slice(2).join(",")].l+get2DmountainRenderedSize(mm).x;
          bounds[2][renderingindex.slice(2).join(",")].b=bounds[2][renderingindex.slice(2).join(",")].t+get2DmountainRenderedSize(mm).y;
        }
        for (var d=2;d<calculatedMountain.dim;d++){
          var mm=findByIndex(calculatedMountain,renderingindex.slice(d+1,-1).reverse());
          lasts[d]=bounds[d][renderingindex.slice(d).join(",")];
          if (cycles){
            var lines=Math.floor(d/2);
            if (d%2){
              ctx.beginPath();
              for (var i=0;i<lines;i++){
                ctx.moveTo(bounds[d][renderingindex.slice(d).join(",")].l,bounds[d][renderingindex.slice(d).join(",")].b+ROWHEIGHT*(i+1)/(lines+1));
                ctx.lineTo(bounds[d][renderingindex.slice(d).join(",")].r,bounds[d][renderingindex.slice(d).join(",")].b+ROWHEIGHT*(i+1)/(lines+1));
              }
              ctx.stroke();
            }else{
              ctx.beginPath();
              for (var i=0;i<lines;i++){
                ctx.moveTo(bounds[d][renderingindex.slice(d).join(",")].r+COLUMNWIDTH*(i+1)/(lines+1),bounds[d][renderingindex.slice(d).join(",")].t);
                ctx.lineTo(bounds[d][renderingindex.slice(d).join(",")].r+COLUMNWIDTH*(i+1)/(lines+1),bounds[d][renderingindex.slice(d).join(",")].b);
              }
              ctx.stroke();
            }
          }
          renderingindex[d]++;
          if (renderingindex[d]>=mm.arr.length){
            if (!cycles){
              bounds[d+1][renderingindex.slice(d+1).join(",")]={l:0,t:0};
              for (var dd=(d+1)%2?d+2:d+1;dd<calculatedMountain.dim;dd+=2){
                if (lasts[dd]){
                  bounds[d+1][renderingindex.slice(d+1).join(",")].l=lasts[dd].r+ +COLUMNWIDTH;
                  break;
                }
              }
              for (var dd=(d+1)%2?d+1:d+2;dd<calculatedMountain.dim;dd+=2){
                if (lasts[dd]){
                  bounds[d+1][renderingindex.slice(d+1).join(",")].t=lasts[dd].b+ +ROWHEIGHT;
                  break;
                }
              }
              bounds[d+1][renderingindex.slice(d+1).join(",")].r=0;
              for (var i=0;i<mm.arr.length;i++){
                bounds[d+1][renderingindex.slice(d+1).join(",")].r=Math.max(bounds[d+1][renderingindex.slice(d+1).join(",")].r,bounds[d][i+","+renderingindex.slice(d+1).join(",")].r+(d+1)%2*COLUMNWIDTH);
              }
              bounds[d+1][renderingindex.slice(d+1).join(",")].b=0;
              for (var i=0;i<mm.arr.length;i++){
                bounds[d+1][renderingindex.slice(d+1).join(",")].b=Math.max(bounds[d+1][renderingindex.slice(d+1).join(",")].b,bounds[d][i+","+renderingindex.slice(d+1).join(",")].b+d%2*ROWHEIGHT);
              }
              if (d==2){
                for (var i=0;i<mm.arr.length;i++){
                  var offset=bounds[d+1][renderingindex.slice(d+1).join(",")].b-d%2*ROWHEIGHT-bounds[d][i+","+renderingindex.slice(d+1).join(",")].b;
                  bounds[d][i+","+renderingindex.slice(d+1).join(",")].t+=offset;
                  bounds[d][i+","+renderingindex.slice(d+1).join(",")].b+=offset;
                }
              }
            }
            renderingindex[d]=0;
            lasts[d]=null;
          }else{
            break;
          }
        }
        if (d>=calculatedMountain.dim) break;
      }
    }
  }
  //enable save
  if (canvas.toBlob&&Promise&&URL&&URL.createObjectURL){
    timesDrawn++;
    (function (timesDrawn){
      new Promise(function (resolve,reject){
        canvas.toBlob(
          function callback(blob){
            resolve(blob);
          },
          "image/png"
        );
      }).then(function (blob){
        doneDrawn++;
        if (blob&&timesDrawn>finalDrawn){
          finalDrawn=timesDrawn;
          URL.revokeObjectURL(outimg.src);
          outimg.src=URL.createObjectURL(blob);
        }
        updateDrawnStatus();
      });
    })(timesDrawn);
  }else{
    outimg.width=canvas.width;
    outimg.height=canvas.height;
    outimg.src=canvas.toDataURL('image/png');
  }
  updateDrawnStatus();
}
function get2DmountainRenderedSize(m){
  while (m.dim<2){
    m={
      dim:m.dim+1,
      arr:[m]
    };
  }
  return {
    x:(findByIndex(m,[0,-1]).position+1-findByIndex(m,[0,0]).position)*COLUMNWIDTH,
    y:m.arr.length*ROWHEIGHT
  };
}
function render2Dmountain(m,x,y){
  while (m.dim<2){
    m={
      dim:m.dim+1,
      arr:[m]
    };
  }
  var leastPosition=findByIndex(m,[0,0]).position;
  for (var j=0;j<m.arr.length;j++){
    var row=m.arr[j];
    for (var k=0;k<row.arr.length;k++){
      var point=row.arr[k];
      ctx.fillText(point.strexp||point.value,x+COLUMNWIDTH*((point.position-leastPosition)*2-j+1)/2-ctx.measureText(point.strexp||point.value).width/2,y+ROWHEIGHT*(m.arr.length-j)-3);
      if (point.parentIndex!=-1){
        ctx.beginPath();
        ctx.moveTo(x+COLUMNWIDTH*((point.position-leastPosition)*2-j+1)/2,y+ROWHEIGHT*(m.arr.length-j)-NUMBERSIZE*Math.min(LINEPLACE,1)-(ROWHEIGHT-NUMBERSIZE)*Math.max(LINEPLACE-1,0)-3);
        ctx.lineTo(x+COLUMNWIDTH*((point.position-leastPosition)*2-j)/2,y+ROWHEIGHT*(m.arr.length-j-1));
        ctx.lineTo(x+COLUMNWIDTH*((row.arr[point.parentIndex].position-leastPosition)*2-j+1)/2,y+ROWHEIGHT*(m.arr.length-j)-NUMBERSIZE*Math.min(LINEPLACE,1)-(ROWHEIGHT-NUMBERSIZE)*Math.max(LINEPLACE-1,0)-3);
        ctx.stroke();
      }
    }
  }
}
function render1Dmountain(m,mm,rowpos){
  while (mm.dim<1){
    mm={
      dim:mm.dim+1,
      arr:[mm]
    };
  }
  var rowid=rowpos[indexFromCoord(m,mm.coord,1).reverse().join(",")+",0"];
  for (var k=0;k<mm.arr.length;k++){
    var point=mm.arr[k];
    ctx.fillText(point.strexp||point.value,COLUMNWIDTH*(point.position*2+1)/2-ctx.measureText(point.strexp||point.value).width/2,(rowid+1)*ROWHEIGHT-3);
    if (point.leftLegCoord){
      ctx.beginPath();
      ctx.moveTo(COLUMNWIDTH*(point.position*2+1)/2,(rowpos[indexFromCoord(m,point.rightLegCoord,1).reverse().join(",")+",0"]+1)*ROWHEIGHT-NUMBERSIZE*Math.min(LINEPLACE,1)-(ROWHEIGHT-NUMBERSIZE)*Math.max(LINEPLACE-1,0)-3);
      ctx.lineTo(COLUMNWIDTH*(point.position*2+1)/2,(rowid+1)*ROWHEIGHT);
      ctx.lineTo(COLUMNWIDTH*(findByCoord(m,point.leftLegCoord).position*2+1)/2,(rowid+2)*ROWHEIGHT-NUMBERSIZE*Math.min(LINEPLACE,1)-(ROWHEIGHT-NUMBERSIZE)*Math.max(LINEPLACE-1,0)-3);
      ctx.lineTo(COLUMNWIDTH*(findByCoord(m,point.leftLegCoord).position*2+1)/2,(rowpos[indexFromCoord(m,point.leftLegCoord,1).reverse().join(",")+",0"]+1)*ROWHEIGHT-NUMBERSIZE*Math.min(LINEPLACE,1)-(ROWHEIGHT-NUMBERSIZE)*Math.max(LINEPLACE-1,0)-3);
      ctx.stroke();
    }
  }
}
function updateDrawnStatus(){
  var d=dg("drawStatus");
  if (timesDrawn==doneDrawn){
    d.style.display="none";
  }else{
    d.style.display="";
    d.innerHTML="Rendering: "+finalDrawn+" - "+doneDrawn+"/"+timesDrawn;
  }
}
window.onpopstate=function (e){
  load();
  requestDraw(true);
}
function saveSimple(clipboard){
  var encodedInput=input.split(lineBreakRegex).map(e=>e.split(itemSeparatorRegex).map(parseSequenceElement).map(e=>e.forcedParent?e.value+"v"+e.parentIndex:e.value)).join(";");
  history.pushState(encodedInput,"","?"+encodedInput);
  if (clipboard){
    var copyarea=dg("copyarea");
    copyarea.value=location.href;
    copyarea.style.display="";
    copyarea.select();
    copyarea.setSelectionRange(0,99999);
    document.execCommand("copy");
    copyarea.style.display="none";
  }
}
function saveDetailed(clipboard){
  var state={};
  for (var i of options){
    state[i]=window[i];
  }
  var encodedState=btoa(JSON.stringify(state)).replace(/\+/g,"-").replace(/\//g,"_").replace(/\=/g,"");
  history.pushState(state,"","?"+encodedState);
  if (clipboard){
    var copyarea=dg("copyarea");
    copyarea.value=location.href;
    copyarea.style.display="";
    copyarea.select();
    copyarea.setSelectionRange(0,99999);
    document.execCommand("copy");
    copyarea.style.display="none";
  }
}
function load(){
  var encodedState=location.search.substring(1);
  if (!encodedState) return;
  try{
    var state=encodedState.replace(/\-/g,"+").replace(/_/g,"/");
    if (state.length%4) state+="=".repeat(4-state.length%4);
    state=JSON.parse(atob(state));
  }catch (e){ //simple
    var input=encodedState.replace(/;/g,"\r\n");
    dg("input").value=input;
  }finally{ //detailed
    console.log(state);
    for (var i of options){
      if (state[i]){
        if (dg(i).type=="number") dg(i).value=state[i];
        else if (dg(i).type=="text") dg(i).value=state[i];
        else if (dg(i).type=="range") dg(i).value=state[i];
        else if (dg(i).type=="checkbox") dg(i).checked=state[i];
      }
    }
  }
}

var handlekey=function(e){
  setTimeout(requestDraw,0,true);
}
