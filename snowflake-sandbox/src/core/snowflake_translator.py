"""Snowflake SQL to Trino SQL translation."""
import re
import structlog
from typing import Dict, Any, List, Tuple
from dataclasses import dataclass


logger = structlog.get_logger()


@dataclass
class TranslationResult:
    """Result of SQL translation."""
    translated_sql: str
    original_sql: str
    transformations_applied: List[str]
    warnings: List[str] = None
    
    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []


class SnowflakeToTrinoTranslator:
    """Translates Snowflake SQL to Trino SQL."""
    
    def __init__(self):
        self.function_mappings = self._build_function_mappings()
        self.data_type_mappings = self._build_data_type_mappings()
        
    def _build_function_mappings(self) -> Dict[str, str]:
        """Build mapping of Snowflake functions to Trino equivalents."""
        return {
            # Date/Time functions
            'CURRENT_TIMESTAMP()': 'CURRENT_TIMESTAMP',
            'CURRENT_DATE()': 'CURRENT_DATE',
            'CURRENT_TIME()': 'CURRENT_TIME',
            'DATEADD': 'DATE_ADD',
            'DATEDIFF': 'DATE_DIFF',
            'DATE_PART': 'EXTRACT',
            'YEAR': 'YEAR',
            'MONTH': 'MONTH',
            'DAY': 'DAY_OF_MONTH',
            
            # String functions
            'CONCAT': 'CONCAT',
            'LENGTH': 'LENGTH',
            'SUBSTR': 'SUBSTR',
            'UPPER': 'UPPER',
            'LOWER': 'LOWER',
            'TRIM': 'TRIM',
            'LTRIM': 'LTRIM',
            'RTRIM': 'RTRIM',
            
            # JSON functions
            'PARSE_JSON': 'CAST(? AS JSON)',
            'OBJECT_CONSTRUCT': 'MAP',
            'ARRAY_CONSTRUCT': 'ARRAY',
            'GET': 'JSON_EXTRACT',
            'GET_PATH': 'JSON_EXTRACT_SCALAR',
            
            # Aggregate functions
            'COUNT': 'COUNT',
            'SUM': 'SUM',
            'AVG': 'AVG',
            'MIN': 'MIN',
            'MAX': 'MAX',
            'STDDEV': 'STDDEV',
            'VARIANCE': 'VARIANCE',
            
            # Window functions
            'ROW_NUMBER': 'ROW_NUMBER',
            'RANK': 'RANK',
            'DENSE_RANK': 'DENSE_RANK',
            'LAG': 'LAG',
            'LEAD': 'LEAD',
            
            # Conditional functions
            'IFF': 'IF',
            'COALESCE': 'COALESCE',
            'NULLIF': 'NULLIF',
            
            # Mathematical functions
            'ABS': 'ABS',
            'CEIL': 'CEIL',
            'FLOOR': 'FLOOR',
            'ROUND': 'ROUND',
            'SQRT': 'SQRT',
            'POWER': 'POWER',
            
            # System functions
            'CURRENT_WAREHOUSE': "'compute_wh'",
            'CURRENT_DATABASE': 'CURRENT_CATALOG',
            'CURRENT_SCHEMA': 'CURRENT_SCHEMA',
            'CURRENT_USER': 'CURRENT_USER'
        }
    
    def _build_data_type_mappings(self) -> Dict[str, str]:
        """Build mapping of Snowflake data types to Trino equivalents."""
        return {
            'NUMBER': 'DECIMAL',
            'FLOAT': 'DOUBLE',
            'STRING': 'VARCHAR',
            'BINARY': 'VARBINARY',
            'BOOLEAN': 'BOOLEAN',
            'DATE': 'DATE',
            'TIME': 'TIME',
            'TIMESTAMP': 'TIMESTAMP',
            'TIMESTAMP_LTZ': 'TIMESTAMP WITH TIME ZONE',
            'TIMESTAMP_NTZ': 'TIMESTAMP',
            'TIMESTAMP_TZ': 'TIMESTAMP WITH TIME ZONE',
            'VARIANT': 'JSON',
            'OBJECT': 'JSON',
            'ARRAY': 'JSON'
        }
    
    def translate(self, sql: str) -> TranslationResult:
        """Translate Snowflake SQL to Trino SQL."""
        logger.info("Starting SQL translation", original_length=len(sql))
        
        original_sql = sql
        translated_sql = sql
        transformations = []
        warnings = []
        
        try:
            # Apply transformations in order
            translated_sql, trans = self._translate_system_commands(translated_sql)
            transformations.extend(trans)
            
            translated_sql, trans = self._translate_functions(translated_sql)
            transformations.extend(trans)
            
            translated_sql, trans = self._translate_data_types(translated_sql)
            transformations.extend(trans)
            
            translated_sql, trans = self._translate_identifiers(translated_sql)
            transformations.extend(trans)
            
            translated_sql, trans = self._translate_special_syntax(translated_sql)
            transformations.extend(trans)
            
            # Validate common incompatibilities
            warnings.extend(self._check_incompatibilities(translated_sql))
            
            logger.info(
                "SQL translation completed",
                transformations_count=len(transformations),
                warnings_count=len(warnings)
            )
            
            return TranslationResult(
                translated_sql=translated_sql,
                original_sql=original_sql,
                transformations_applied=transformations,
                warnings=warnings
            )
            
        except Exception as e:
            logger.error("SQL translation failed", error=str(e))
            raise
    
    def _translate_system_commands(self, sql: str) -> Tuple[str, List[str]]:
        """Translate Snowflake system commands."""
        transformations = []
        
        # USE WAREHOUSE -> no-op (just remove)
        if re.search(r'\bUSE\s+WAREHOUSE\s+\w+', sql, re.IGNORECASE):
            sql = re.sub(r'\bUSE\s+WAREHOUSE\s+\w+\s*;?\s*', '', sql, flags=re.IGNORECASE)
            transformations.append("Removed USE WAREHOUSE commands")
        
        # USE DATABASE -> USE CATALOG
        pattern = r'\bUSE\s+DATABASE\s+(\w+)'
        if re.search(pattern, sql, re.IGNORECASE):
            sql = re.sub(pattern, r'USE \1', sql, flags=re.IGNORECASE)
            transformations.append("Translated USE DATABASE to USE catalog")
        
        # SHOW WAREHOUSES -> Return empty (not applicable)
        if re.search(r'\bSHOW\s+WAREHOUSES\b', sql, re.IGNORECASE):
            sql = re.sub(
                r'\bSHOW\s+WAREHOUSES\b',
                "SELECT 'compute_wh' AS name, 'RUNNING' AS state",
                sql,
                flags=re.IGNORECASE
            )
            transformations.append("Translated SHOW WAREHOUSES")
        
        return sql, transformations
    
    def _translate_functions(self, sql: str) -> Tuple[str, List[str]]:
        """Translate Snowflake functions to Trino equivalents."""
        transformations = []
        
        for snowflake_func, trino_func in self.function_mappings.items():
            # Handle simple function name replacements
            pattern = r'\b' + re.escape(snowflake_func) + r'\b'
            if re.search(pattern, sql, re.IGNORECASE):
                sql = re.sub(pattern, trino_func, sql, flags=re.IGNORECASE)
                transformations.append(f"Translated {snowflake_func} -> {trino_func}")
        
        # Special handling for complex functions
        sql, special_trans = self._translate_special_functions(sql)
        transformations.extend(special_trans)
        
        return sql, transformations
    
    def _translate_special_functions(self, sql: str) -> Tuple[str, List[str]]:
        """Handle complex function translations."""
        transformations = []
        
        # DATE_PART(part, date) -> EXTRACT(part FROM date)
        pattern = r'\bDATE_PART\s*\(\s*[\'"]([^\'\"]+)[\'"]\s*,\s*([^)]+)\)'
        def replace_date_part(match):
            part = match.group(1)
            date_expr = match.group(2)
            return f'EXTRACT({part} FROM {date_expr})'
        
        if re.search(pattern, sql, re.IGNORECASE):
            sql = re.sub(pattern, replace_date_part, sql, flags=re.IGNORECASE)
            transformations.append("Translated DATE_PART to EXTRACT")
        
        # IFF(condition, true_expr, false_expr) -> IF(condition, true_expr, false_expr)
        pattern = r'\bIFF\s*\('
        if re.search(pattern, sql, re.IGNORECASE):
            sql = re.sub(pattern, 'IF(', sql, flags=re.IGNORECASE)
            transformations.append("Translated IFF to IF")
        
        return sql, transformations
    
    def _translate_data_types(self, sql: str) -> Tuple[str, List[str]]:
        """Translate Snowflake data types to Trino equivalents."""
        transformations = []
        
        for snowflake_type, trino_type in self.data_type_mappings.items():
            pattern = r'\b' + re.escape(snowflake_type) + r'\b'
            if re.search(pattern, sql, re.IGNORECASE):
                sql = re.sub(pattern, trino_type, sql, flags=re.IGNORECASE)
                transformations.append(f"Translated data type {snowflake_type} -> {trino_type}")
        
        return sql, transformations
    
    def _translate_identifiers(self, sql: str) -> Tuple[str, List[str]]:
        """Handle identifier translations."""
        transformations = []
        
        # Convert three-part identifiers (database.schema.table) 
        # In Trino: catalog.schema.table
        # This is mostly handled by the connection context
        
        return sql, transformations
    
    def _translate_special_syntax(self, sql: str) -> Tuple[str, List[str]]:
        """Handle special Snowflake syntax."""
        transformations = []
        
        # LIMIT with OFFSET handling
        # Snowflake: LIMIT n OFFSET m
        # Trino: OFFSET m LIMIT n
        pattern = r'\bLIMIT\s+(\d+)\s+OFFSET\s+(\d+)\b'
        def reorder_limit_offset(match):
            limit = match.group(1)
            offset = match.group(2)
            return f'OFFSET {offset} LIMIT {limit}'
        
        if re.search(pattern, sql, re.IGNORECASE):
            sql = re.sub(pattern, reorder_limit_offset, sql, flags=re.IGNORECASE)
            transformations.append("Reordered LIMIT OFFSET to OFFSET LIMIT")
        
        return sql, transformations
    
    def _check_incompatibilities(self, sql: str) -> List[str]:
        """Check for potential incompatibilities."""
        warnings = []
        
        # Check for VARIANT operations that might not translate well
        if re.search(r'\bVARIANT\b', sql, re.IGNORECASE):
            warnings.append("VARIANT operations may need manual review")
        
        # Check for Snowflake-specific time travel
        if re.search(r'\bAT\s*\(\s*TIMESTAMP\s*=>', sql, re.IGNORECASE):
            warnings.append("Time travel syntax is not supported in Trino")
        
        # Check for Snowflake-specific clustering
        if re.search(r'\bCLUSTER\s+BY\b', sql, re.IGNORECASE):
            warnings.append("CLUSTER BY syntax is not directly supported in Trino")
        
        return warnings