 function renderCommentsPage(page) {
      const list = document.getElementById('comments-list');
      const pag = document.getElementById('comments-pagination');
      if (!Array.isArray(commentsData) || commentsData.length === 0) {
        list.innerHTML = '<div class="comment-empty">No comments yet.</div>';
        pag.innerHTML = '';
        return;
      }
      // Newest to oldest
      const totalPages = Math.ceil(commentsData.length / COMMENTS_PER_PAGE);
      page = Math.max(1, Math.min(page, totalPages));
      currentPage = page;
      const start = (page - 1) * COMMENTS_PER_PAGE;
      const end = start + COMMENTS_PER_PAGE;
      const pageComments = commentsData.slice().reverse().slice(start, end);
      list.innerHTML = pageComments.map((c, idx) => {
        const globalIdx = commentsData.length - 1 - (start + idx);
        let editDelete = '';
        if (currentUser && c.name === currentUser) {
          editDelete = 
            '<button class="comment-edit-btn" data-idx="'+globalIdx+'">Edit</button>' +
            '<button class="comment-delete-btn" data-idx="'+globalIdx+'">Delete</button>';
        }
        return (
          '<div class="comment">' +
            '<div class="comment-meta"><span class="comment-name">' + (c.name ? c.name : 'Anonymous') + '</span> ' +
            '<span class="comment-date">' + (new Date(c.date).toLocaleString()) + '</span>' +
            (c.edited ? ' <span class="comment-edited">(edited)</span>' : '') +
            '</div>' +
            '<h2 class="comment-body" id="comment-body-'+globalIdx+'">' + c.text.replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\\n/g,"<br>") + '</h2>' +
            (editDelete ? '<div class="comment-actions">'+editDelete+'</div>' : '') +
          '</div>'
        );
      }).join('');
      // Pagination
      if (totalPages > 1) {
        let pagHtml = '';
        for (let i = 1; i <= totalPages; ++i) {
          pagHtml += '<button class="comment-page-btn" data-page="'+i+'"'+(i===page?' style="background:#FF6B00;color:#fff;"':'')+'>'+i+'</button> ';
        }
        pag.innerHTML = pagHtml;
      } else {
        pag.innerHTML = '';
      }
    }

function fetchComments() {
  fetch('/comments?category=' + encodeURIComponent(window.commentCategory) + '&filename=' + encodeURIComponent(window.commentFilename))
    .then(res => res.json())
    .then(comments => {
      commentsData = comments;
      renderCommentsPage(currentPage);
    });
}

    // Check login status for Google (by trying to fetch /user-info)
    fetch('/user-info').then(res => res.json()).then(data => {
      if (data && data.loggedIn) {
        currentUser = data.name;
        document.getElementById('comment-form').style.display = '';
        document.getElementById('google-login-prompt').style.display = 'none';
      } else {
        currentUser = null;
        document.getElementById('comment-form').style.display = 'none';
        document.getElementById('google-login-prompt').style.display = '';
      }
    }).catch(() => {
      currentUser = null;
      document.getElementById('comment-form').style.display = 'none';
      document.getElementById('google-login-prompt').style.display = '';
    });

    document.getElementById('comment-form').onsubmit = function(e) {
      e.preventDefault();
      const text = document.getElementById('comment-text').value.trim();
      if (!text) return;
      fetch('/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: window.commentCategory,
          filename: window.commentFilename,
          text
        })
      }).then(res => res.json()).then(r => {
        const status = document.getElementById('comment-status');
        if (r.success) {
          document.getElementById('comment-form').reset();
          status.textContent = '';
          fetchComments();
        } else if (r.error) {
          status.textContent = r.error;
        }
      });
    };

    // Pagination click
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('comment-page-btn')) {
        renderCommentsPage(Number(e.target.getAttribute('data-page')));
      }
      // Edit
      if (e.target.classList.contains('comment-edit-btn')) {
        const idx = Number(e.target.getAttribute('data-idx'));
        const c = commentsData[idx];
        const bodyEl = document.getElementById('comment-body-'+idx);
        if (!bodyEl) return;
        // Replace with textarea and save/cancel
        const origText = c.text;
        bodyEl.innerHTML = '<textarea id="edit-comment-text" style="width:100%;min-height:60px;">'+origText.replace(/</g,"&lt;").replace(/>/g,"&gt;")+'</textarea>' +
          '<br><button id="save-edit-btn" style="background:#FF6B00;color:#fff;margin-right:0.5em;">Save</button>' +
          '<button id="cancel-edit-btn">Cancel</button>';
        document.getElementById('save-edit-btn').onclick = function() {
          const newText = document.getElementById('edit-comment-text').value.trim();
          if (!newText) return;
          fetch('/edit-comment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category: window.commentCategory,
              filename: window.commentFilename,
              index: idx,
              text: newText
            })
          }).then(res => res.json()).then(r => {
            if (r.success) fetchComments();
            else alert(r.error || 'Failed to edit comment');
          });
        };
        document.getElementById('cancel-edit-btn').onclick = function() {
          fetchComments();
        };
      }
      // Delete
      if (e.target.classList.contains('comment-delete-btn')) {
        const idx = Number(e.target.getAttribute('data-idx'));
        if (!confirm('Delete this comment?')) return;
        fetch('/delete-comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: window.commentCategory,
            filename: window.commentFilename,
            index: idx
          })
        }).then(res => res.json()).then(r => {
          if (r.success) fetchComments();
          else alert(r.error || 'Failed to delete comment');
        });
      }
    });

    fetchComments();
    // Style the comment button with the orange from the stylesheet
    document.addEventListener('DOMContentLoaded', function() {
      var btn = document.getElementById('comment-submit-btn');
      if (btn) {
        btn.style.background = '#FF6B00';
        btn.style.color = '#fff';
        btn.style.border = 'none';
        btn.style.borderRadius = '0.7rem';
        btn.style.fontWeight = 'bold';
        btn.style.fontSize = '1.2rem';
        btn.style.cursor = 'pointer';
      }
    });