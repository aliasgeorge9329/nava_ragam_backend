
      // document.onload=function(){
      //       alert('ss')
      //       window.scrollTo(0,50)
      //       // setTimeout(window.scrollTo(0,50),2000)
      // }
      function openForm() {
            
  document.getElementById("myForm").style.display = "block";
//   document.getElementById("myRegister").style.display = "none";
document.getElementById("myAbout").style.display = "none";
setTimeout(window.scrollTo(0,1000),1000)
      
}

function closeForm() {
  document.getElementById("myForm").style.display = "none";
}
function closeAbout() {
  document.getElementsByClassName("collage_container")[0].display="inline-block"
  document.getElementById("myAbout").style.display = "none";
}
function openAbout() {
//   document.getElementById("myRegister").style.display = "none";
console.log(document.getElementsByClassName("collage_container")[0])

document.getElementsByClassName("collage_container")[0].visibility = 'hidden'; 
  document.getElementById("myForm").style.display = "none";
  document.getElementById("myAbout").style.display = "block";
}
