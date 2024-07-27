function openBar(){
    const bar=document.getElementById('sidebar');
    bar.style.width="300px";
    document.getElementById('half-circle').style.display="none";
    document.getElementById('expand').style.display="none";
    document.getElementById('close').style.display="block";
    document.getElementById('close-circle').style.display="block";
    document.getElementById('xmark').style.display="block";
}
function closeBar(){
    const bar=document.getElementById('sidebar');
    bar.style.width="0";
    document.getElementById('half-circle').style.display="block";
    document.getElementById('expand').style.display="block";
    document.getElementById('close').style.display="none";
    document.getElementById('close-circle').style.display="none";
    document.getElementById('xmark').style.display="none";
}