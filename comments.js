import { getDatabase, ref, push, set } 
  from "https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js";

const db = getDatabase(app);

function saveComment(text) {
  const commentsRef = ref(db, "comments");
  const newComment = push(commentsRef);
  set(newComment, {
    text: text,
    timestamp: Date.now()
  });
}

document.getElementById("submit-comment").addEventListener("click", () => {
  const input = document.getElementById("comment-input");
  const text = input.value.trim();
  if (text) {
    saveComment(text);
    input.value = "";
    alert("✅ Thanks! Your comment was submitted.");
  }
});
