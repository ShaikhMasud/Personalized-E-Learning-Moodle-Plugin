```php
<?php

require_once(__DIR__.'/../../config.php');
require_login();

$courseid = get_config('local_automation', 'student_ai_courseid');

if (!$courseid) {
    print_error('Student AI course not configured in plugin settings.');
}

$context = context_course::instance($courseid);
require_capability('moodle/course:view', $context);

$PAGE->set_url('/local/automation/analytics_page.php');
$PAGE->set_pagelayout('standard');
$PAGE->set_title('Course Analytics');
$PAGE->set_heading('Course Analytics');

echo $OUTPUT->header();
?>

<div id="analytics-container">

<div id="student-list">
<h3>Students</h3>
</div>

<div id="student-details" style="display:none;">
<button onclick="loadStudents()">Back</button>
<div id="student-content"></div>
</div>

</div>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<script>

const courseid = <?php echo (int)$courseid; ?>;

function loadStudents(){

fetch(M.cfg.wwwroot + "/local/automation/analytics_ajax.php",{
method:"POST",
headers:{'Content-Type':'application/x-www-form-urlencoded'},
body:new URLSearchParams({
action:'get_students',
courseid:courseid,
sesskey:M.cfg.sesskey
})
})
.then(r=>r.json())
.then(students=>{

let html="<h3>Students</h3>";

students.forEach(s=>{
html+=`
<div onclick="loadStudentDetails(${s.id},'${s.firstname} ${s.lastname}')"
style="cursor:pointer;padding:8px;border-bottom:1px solid #ddd;">
${s.firstname} ${s.lastname}
</div>`;
});

document.getElementById("student-list").innerHTML=html;
document.getElementById("student-list").style.display="block";
document.getElementById("student-details").style.display="none";
document.getElementById("student-content").innerHTML="";

});

}

function loadStudentDetails(studentid,name){

document.getElementById("student-list").style.display="none";
document.getElementById("student-details").style.display="block";
document.getElementById("student-content").innerHTML="";

fetch(M.cfg.wwwroot + "/local/automation/analytics_ajax.php",{
method:"POST",
headers:{'Content-Type':'application/x-www-form-urlencoded'},
body:new URLSearchParams({
action:'get_student_quiz',
courseid:courseid,
studentid:studentid,
sesskey:M.cfg.sesskey
})
})
.then(r=>r.json())
.then(data=>{

const sections=["U1","U2","U3","U4","U5","U6"];

let topics={};

sections.forEach(s=>{
topics[s]={
easy:{attempts:0,score:0,total:0},
medium:{attempts:0,score:0,total:0},
hard:{attempts:0,score:0,total:0}
};
});

data.forEach(q=>{

let diff=q.difficulty.toLowerCase();
let topicText=q.topic.toUpperCase();

/* Extract units safely using regex */
let matches = topicText.match(/UNIT\s+(VI|IV|V|III|II|I)/g);

if(matches){

matches.forEach(unit=>{

let roman = unit.replace("UNIT","").trim();

let map={
"I":"U1",
"II":"U2",
"III":"U3",
"IV":"U4",
"V":"U5",
"VI":"U6"
};

let u = map[roman];

if(u){
topics[u][diff].attempts += 1;
topics[u][diff].score += parseInt(q.score);
topics[u][diff].total += parseInt(q.total);
}

});

}

});

/* BUILD GRAPH DATA */

let labels=sections;

let easy=[];
let medium=[];
let hard=[];

let tooltipData={
easy:[],
medium:[],
hard:[]
};

labels.forEach(t=>{

easy.push(topics[t].easy.attempts);
medium.push(topics[t].medium.attempts);
hard.push(topics[t].hard.attempts);

tooltipData.easy.push(topics[t].easy.score+"/"+topics[t].easy.total);
tooltipData.medium.push(topics[t].medium.score+"/"+topics[t].medium.total);
tooltipData.hard.push(topics[t].hard.score+"/"+topics[t].hard.total);

});

/* HTML */

let html=`<h3>${name}</h3>

<div style="width:100%;max-width:800px;margin-bottom:20px;">
<canvas id="quizChart"></canvas>
</div>

<h4>Quiz Attempts</h4>`;

if(data.length===0){
html+="<div>No quiz attempts</div>";
}else{

data.forEach(q=>{
html+=`
<div style="padding:6px;border-bottom:1px solid #eee;">
Score: ${q.score}/${q.total}<br>
Topic: ${q.topic}<br>
Difficulty: ${q.difficulty}
</div>`;
});

}

document.getElementById("student-content").insertAdjacentHTML("beforeend", html);

/* CHART */

const ctx=document.getElementById('quizChart');

new Chart(ctx,{
type:'bar',
data:{
labels:labels,
datasets:[
{
label:'Easy',
data:easy,
backgroundColor:'#4CAF50'
},
{
label:'Medium',
data:medium,
backgroundColor:'#FFC107'
},
{
label:'Hard',
data:hard,
backgroundColor:'#F44336'
}
]
},
options:{
responsive:true,
plugins:{
tooltip:{
callbacks:{
label:function(context){

let dataset=context.dataset.label.toLowerCase();
let index=context.dataIndex;

return dataset+" attempts: "+context.raw+
" | score: "+tooltipData[dataset][index];

}
}
}
},
scales:{
y:{
beginAtZero:true,
ticks:{
stepSize:1,
precision:0
},
title:{
display:true,
text:'Number of Attempts'
}
},
x:{
title:{
display:true,
text:'Sections'
}
}
}
}
});

loadChat(studentid);

});

}

function loadChat(studentid){

fetch(M.cfg.wwwroot + "/local/automation/analytics_ajax.php",{
method:"POST",
headers:{'Content-Type':'application/x-www-form-urlencoded'},
body:new URLSearchParams({
action:'get_student_chat',
courseid:courseid,
studentid:studentid,
sesskey:M.cfg.sesskey
})
})
.then(r=>r.json())
.then(data=>{

let html="<h4>Chat History</h4>";

if(data.length===0){
html+="<div>No chat history</div>";
}else{

data.forEach(c=>{
html+=`<div><b>${c.sender}</b>: ${c.message}</div>`;
});

}

document.getElementById("student-content").insertAdjacentHTML("beforeend", html);

});

}

loadStudents();

</script>

<?php
echo $OUTPUT->footer();
?>
```
