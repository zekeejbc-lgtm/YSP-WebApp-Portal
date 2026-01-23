const SPREADSHEET_ID = "1837AfQpepOB0IIHtUvTqomBmeaiX-5r64J8tEpEmXL4";
const SHEET_NAME = "Feedbacks";
const FEEDBACK_IMAGES_FOLDER_ID = "1K-QweGSEp2HNQZnkPIE8f3FKuQkLp_mp";

function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const action = e.parameter.action;

    if (action === "initiate") {
      return initiateFeedbackSheets();
    } else if (action === "getFeedbacks") {
      return getFeedbacks();
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Invalid action"
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === "createFeedback") {
      return createFeedback(data);
    } else if (action === "updateFeedback") {
      return updateFeedback(data);
    } else if (action === "uploadImage") {
      return handleImageUpload(data.fileName, data.fileData);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Invalid action"
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
* Handle image upload to Google Drive
* Expects base64 encoded file data
*/
function handleImageUpload(fileName, base64Data) {
  try {
    const folder = DriveApp.getFolderById(FEEDBACK_IMAGES_FOLDER_ID);
    
    // Decode base64 and create blob
    const decodedData = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decodedData, 'image/jpeg', fileName);
    
    // Upload file to folder
    const file = folder.createFile(blob);
    
    // Set public sharing
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Get the CORS-free public link
    const publicLink = convertToCORSFreeLink(file.getUrl());
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      imageUrl: publicLink,
      message: 'Image uploaded successfully',
      fileName: fileName
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error('Error uploading image:', error);
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: 'Error uploading image: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
* Convert Google Drive link to CORS-free public view link
* Modified to strongly force thumbnail generation for better CORS support
*/
function convertToCORSFreeLink(driveUrl) {
  try {
    // Extract file ID from various Google Drive URL formats
    let fileId = '';
    
    if (driveUrl.includes('/file/d/')) {
      fileId = driveUrl.split('/file/d/')[1].split('/')[0];
    } else if (driveUrl.includes('id=')) {
      fileId = driveUrl.split('id=')[1].split('&')[0];
    } else if (driveUrl.includes('?id=')) {
      fileId = driveUrl.split('?id=')[1];
    }

    if (!fileId) {
      return driveUrl; // Return original if can't parse
    }

    // Return Google Drive Thumbnail Link 
    // AND bypass virus scan warnings for larger images
    // sz=w4000 asks for a width of 4000px, ensuring high quality
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w4000`;

  } catch (error) {
    console.error('Error converting link:', error);
    return driveUrl;
  }
}


function initiateFeedbackSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  const headers = [
    "id", "timestamp", "author", "authorId", "feedback", 
    "replyTimestamp", "replier", "replierId", "reply", 
    "anonymous", "category", "imageUrl", "status", 
    "visibility", "notes", "email", "rating"
  ];

  const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const headersMatch = headers.every((h, i) => h === currentHeaders[i]);

  if (!headersMatch) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Feedback sheet initiated successfully"
  })).setMimeType(ContentService.MimeType.JSON);
}

function getFeedbacks() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
     return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Sheet not found. Please initiate first."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);

  const feedbacks = rows.map(row => {
    const feedback = {};
    headers.forEach((header, index) => {
      // Convert boolean strings back to booleans
      if (header === 'anonymous') {
         feedback[header] = row[index] === true || row[index] === "true";
      } else {
         feedback[header] = row[index];
      }
    });
    return feedback;
  });

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    data: feedbacks
  })).setMimeType(ContentService.MimeType.JSON);
}

function createFeedback(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Sheet not found"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const feedbackData = data.feedbackData;
  // Ensure strict column order matches headers
  const rowData = [
    feedbackData.id,
    feedbackData.timestamp,
    feedbackData.author,
    feedbackData.authorId,
    feedbackData.feedback,
    feedbackData.replyTimestamp || "",
    feedbackData.replier || "",
    feedbackData.replierId || "",
    feedbackData.reply || "",
    feedbackData.anonymous,
    feedbackData.category,
    feedbackData.imageUrl || "",
    feedbackData.status,
    feedbackData.visibility,
    feedbackData.notes || "",
    feedbackData.email || "",
    feedbackData.rating
  ];

  sheet.appendRow(rowData);

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Feedback submitted successfully",
    id: feedbackData.id
  })).setMimeType(ContentService.MimeType.JSON);
}

function updateFeedback(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  const feedbackData = data.feedbackData;
  const idToUpdate = feedbackData.id;
  
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  // Find row index (0-based) in values array, so +1 for sheet row
  const rowIndex = values.findIndex(row => row[0] === idToUpdate);
  
  if (rowIndex === -1) {
      return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Feedback ID not found"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // Map headers to column indices for updates
  const headers = values[0];
  const rowNumber = rowIndex + 1;
  
  // We'll update the whole row to be safe, constructing it same as create
  const updatedRow = [
    feedbackData.id,
    feedbackData.timestamp,
    feedbackData.author,
    feedbackData.authorId,
    feedbackData.feedback,
    feedbackData.replyTimestamp || "",
    feedbackData.replier || "",
    feedbackData.replierId || "",
    feedbackData.reply || "",
    feedbackData.anonymous,
    feedbackData.category,
    feedbackData.imageUrl || "",
    feedbackData.status,
    feedbackData.visibility,
    feedbackData.notes || "",
    feedbackData.email || "",
    feedbackData.rating
  ];

  sheet.getRange(rowNumber, 1, 1, updatedRow.length).setValues([updatedRow]);

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    message: "Feedback updated successfully"
  })).setMimeType(ContentService.MimeType.JSON);
}
