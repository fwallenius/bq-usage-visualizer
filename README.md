# bq-usage-visualizer
A solution for visualizing the query costs and usage over day, generated in BigQuery, for a Google Compute Platform project.

Using the following guide you will end up with a spreadsheet showing the BigQuery query costs over time and per user in one project in near real-time.

This is acheived by plumbing together already existing Google technologies, i.e. you will not have to deploy scary code anywhere.

## High-level description

Google Cloud Platform (GCP) has audit logging available for most of the products. In this solution we setup streaming of the BigQuery (BQ) audit logs into, well, BigQuery. Every query run in BQ generates an audit log entry that mong other things states who ran the query and how many bytes that was processed. 

We then create a Google Apps spreadsheet that queries the audit logs to generate graphs and diagrams showing details over the last 30 days of usage for the given GCP project.

@TODO: Show example graph here

## Step by step guide

In the name of speed and efficiency most of the plumbing is done using the command line terminal. The full setup can be done in the Google Cloud Developer Console as well.

### Pre-conditions

* Create a new project or select an existing one. 
* Grab the project’s ID and number from the Developer Console:
  * TODO: Picture here

* Fire up a bash session and store them in two variables:
```bash
$ export PROJECT_ID=the-bigquery-project
$ export PROJECT_NUMBER=600424227998
```
* Then make sure your gcloud command defaults to this project:
```bash
$ gcloud config set project $PROJECT_ID
```