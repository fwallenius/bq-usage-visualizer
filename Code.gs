function execute() {

  // Get one cells value from the data sheet
  function getInputData(cellString) {
    var sheet = SpreadsheetApp.getActive().getSheetByName("data");
    return sheet.getRange(cellString).getCell(1, 1).getValue();
  }
  
  // Set the (string) value of one cell
  function setCellValue(cellString, value) {
    SpreadsheetApp.getActive().getRange(cellString).setValue(value);
  }
  
  // Execute in BQ
  function runBQ(query, projectId) {
    
    var request = {
      query: query
    };
    var queryResults = BigQuery.Jobs.query(request, projectId);
    var jobId = queryResults.jobReference.jobId;
    
    // Exponential backoff until job is complete
    var sleepTimeMs = 500;
    while (!queryResults.jobComplete) {
      Utilities.sleep(sleepTimeMs);
      sleepTimeMs *= 2;
      queryResults = BigQuery.Jobs.getQueryResults(projectId, jobId);
    }
    
    // Get all the rows of results.
    var rows = queryResults.rows;
    while (queryResults.pageToken) {
      queryResults = BigQuery.Jobs.getQueryResults(projectId, jobId, {
        pageToken: queryResults.pageToken
      });
      rows = rows.concat(queryResults.rows);
    }
    
    return rows;
  }
  
  function insertIntoSheet(sheetName, headers, rows) {
    var sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
    
    sheet.clear();
    sheet.appendRow(headers);
    
    var data = new Array(rows.length);
    for (var i = 0; i < rows.length; i++) {
      
      var cols = rows[i].f;
      data[i] = new Array(cols.length);
      
      for (j = 0; j < cols.length; j++) {
        data[i][j] = cols[j].v;
      }
    }
    
    sheet.getRange(2, 1, rows.length, headers.length).setValues(data);
  }
  
  // To create a multi-series line chart the matrix need to look slightly different
  function transformForLineChart(rows) {
    var data = [];
    var accountMap = {};
    var dateMap = {};
    var result = [];
    
    rows.forEach(function (row) {
      var item = {
        date: row.f[0].v,
        account: row.f[1].v,
        gb: row.f[2].v
      };
      
      data.push(item);
      accountMap[item.account] = [];
      dateMap[item.date] = {};
    });
    
    data.forEach(function (item) {
      dateMap[item.date][item.account] = item.gb;
    });
    
    // Header
    var headerRow = {f:[{v: "Date"}]};
    for (var account in accountMap) {
      if (accountMap.hasOwnProperty(account)) {
        headerRow.f.push({v: account});
      }
    }
    result.push(headerRow);
    
    // Individual rows
    for (var date in dateMap) {
      if (dateMap.hasOwnProperty(date)) {
        var row = [{v:date}];
        
        for (var account in accountMap) {
          if (accountMap.hasOwnProperty(account)) {
            var gb = dateMap[date][account];
            if (gb) {
              row.push({v:gb});
            } else {
              row.push({v:0});
            }
          }
        }
        result.push({f:row});
      }
    }
    
    if (typeof require === 'function') {   //If debugging in node.js
      console.log(require('util').inspect(result, {depth: 4})); 
    }
    return result;
    
  }
  
  
  // Start point!
  var projectId = getInputData("C2:C2");
  var datasetName = getInputData("C3:C3");
  var rows;
  
  rows = runBQ("SELECT DATE(ts) as date, SUM(total_bytes) / 1000000000 AS bytes FROM [" + datasetName + ".usage_simplified] GROUP BY date ORDER BY date ASC", projectId);
  insertIntoSheet("usage_per_day", ["Date", "GBs"], rows);
  
  rows = runBQ("SELECT user AS account, SUM(total_bytes) / 1000000000 AS gbs FROM [" + datasetName + ".usage_simplified] GROUP BY account ORDER BY gbs DESC LIMIT 10", projectId);
  insertIntoSheet("usage_per_account", ["Account", "GBs"], rows);
  
  rows = runBQ("SELECT DATE(ts) AS date, user AS account, SUM(total_bytes) / 1000000000 AS gbs FROM [" + datasetName + ".usage_simplified] WHERE user IN ( SELECT user FROM ( SELECT user, SUM(total_bytes) AS total_bytes FROM [bq_audit_logs.usage_simplified] WHERE ts > DATE_ADD(CURRENT_TIMESTAMP(), -6, \"DAY\") GROUP BY user ORDER BY total_bytes DESC LIMIT 5 )) AND ts > DATE_ADD(CURRENT_TIMESTAMP(), -6, \"DAY\") GROUP BY date, account ORDER BY date ASC, account ASC ", projectId); 
  var rowsTransformed = transformForLineChart(rows);
  var headerInput = rowsTransformed.shift();
  var headers = [];
  headerInput.f.forEach(function(item) {
    headers.push(item.v);
  });
  insertIntoSheet("top_five_last_week", headers, rowsTransformed);
  
  setCellValue("Report!C4", new Date());
  SpreadsheetApp.getActive().getRange("Report!C4").setNumberFormat("yyyy-mm-dd h:m");
}