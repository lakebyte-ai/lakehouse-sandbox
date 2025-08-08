from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator

default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

def hello_world():
    print("Hello World from Airflow!")
    return "Hello World!"

with DAG(
    'hello_world_dag',
    default_args=default_args,
    description='A simple Hello World DAG',
    schedule=timedelta(days=1),
    start_date=datetime(2024, 1, 1),
    catchup=False,
    tags=['example'],
) as dag:

    hello_task = PythonOperator(
        task_id='hello_world_task',
        python_callable=hello_world,
    )